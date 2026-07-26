import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlansService } from './plans.service';
import { MacroMethod } from './dto/recalculate-plan.dto';

function buildPrismaMock() {
    return {
        patient: { findFirst: jest.fn() },
        assessment: { findFirst: jest.fn() },
        nutritionalPlan: {
            findFirst: jest.fn(),
            findFirstOrThrow: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };
}

const COMPLETED_ASSESSMENT = {
    id: 'assessment-1',
    patientId: 'patient-1',
    status: 'COMPLETED',
    date: new Date('2026-01-01'),
    ageAtAssessmentMonths: 360,
    populationGroup: 'ADULT',
    measurements: [
        { definitionId: 'm_weight', numericValue: 65, stringValue: null },
        { definitionId: 'm_height', numericValue: 165, stringValue: null },
    ],
};

const PATIENT = { id: 'patient-1', userId: 'user-1', sex: 'FEMALE', activityLevel: 'MODERATE' };

describe('PlansService', () => {
    let prisma: ReturnType<typeof buildPrismaMock>;
    let planCalculation: { calculate: jest.Mock };
    let service: PlansService;

    beforeEach(() => {
        prisma = buildPrismaMock();
        planCalculation = { calculate: jest.fn().mockReturnValue({ BMI: { status: 'CALCULATED' } }) };
        service = new PlansService(prisma as any, planCalculation as any);
    });

    describe('ownership isolation (Fase F)', () => {
        it('findOne throws NotFoundException when userId does not match', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            await expect(service.findOne('other-user', 'patient-1', 'plan-1')).rejects.toThrow(NotFoundException);
            expect(prisma.nutritionalPlan.findFirst).toHaveBeenCalledWith({ where: { id: 'plan-1', patientId: 'patient-1', userId: 'other-user' } });
        });

        it('findOne throws NotFoundException when the plan belongs to a different patient, even if userId matches', async () => {
            // Simulates the Fase F fix: the plan exists for this user but under a different patientId,
            // so the compound findFirst filter must exclude it.
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            await expect(service.findOne('user-1', 'someone-elses-patient', 'plan-1')).rejects.toThrow(NotFoundException);
            expect(prisma.nutritionalPlan.findFirst).toHaveBeenCalledWith({ where: { id: 'plan-1', patientId: 'someone-elses-patient', userId: 'user-1' } });
        });
    });

    describe('createOrGetDraft', () => {
        it('throws NotFoundException when the patient does not belong to the user', async () => {
            prisma.patient.findFirst.mockResolvedValue(null);
            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(NotFoundException);
        });

        it('returns the existing draft without recomputing when one already exists', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            const existing = { id: 'plan-existing', status: 'DRAFT' };
            prisma.nutritionalPlan.findFirst.mockResolvedValue(existing);

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);

            expect(result).toBe(existing);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(prisma.assessment.findFirst).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when the assessment is not COMPLETED', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue({ ...COMPLETED_ASSESSMENT, status: 'DRAFT' });

            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(BadRequestException);
        });

        it('builds a snapshot from the assessment and persists the computed calculationResults', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            prisma.nutritionalPlan.create.mockResolvedValue({ id: 'new-plan' });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);

            expect(planCalculation.calculate).toHaveBeenCalledWith(
                expect.objectContaining({ assessmentId: 'assessment-1', sex: 'FEMALE', measurementValues: { m_weight: 65, m_height: 165 } }),
                expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55 }),
            );
            expect(prisma.nutritionalPlan.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'assessment-1', engineVersion: 'v1.0.0' }) }),
            );
            expect(result).toEqual({ id: 'new-plan' });
        });

        it('handles a concurrent-create race (DB partial unique index) by returning the winning draft', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
            prisma.nutritionalPlan.create.mockRejectedValue(p2002);
            prisma.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'winning-draft' });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);
            expect(result).toEqual({ id: 'winning-draft' });
        });
    });

    describe('recalculate', () => {
        const dto = {
            bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
            pal: 1.55,
            macroMethod: MacroMethod.PERCENT,
            macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
            fiberSourceId: 'FIBER_IOM_V1',
            waterSourceId: 'WATER_IOM_V1',
        } as any;

        it('throws NotFoundException when the plan is not owned by this patient/user', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', dto)).rejects.toThrow(NotFoundException);
        });

        it('blocks recalculation of a FINALIZED plan (immutability)', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'plan-1', patientId: 'patient-1', status: 'FINALIZED', assessmentId: 'assessment-1' });
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', dto)).rejects.toThrow(BadRequestException);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(prisma.nutritionalPlan.update).not.toHaveBeenCalled();
        });

        it('recomputes and persists calculationResults for a DRAFT plan', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'plan-1', patientId: 'patient-1', status: 'DRAFT', assessmentId: 'assessment-1' });
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            prisma.nutritionalPlan.update.mockResolvedValue({ id: 'plan-1' });

            await service.recalculate('user-1', 'patient-1', 'plan-1', dto);

            expect(planCalculation.calculate).toHaveBeenCalledWith(expect.objectContaining({ assessmentId: 'assessment-1' }), dto);
            expect(prisma.nutritionalPlan.update).toHaveBeenCalledWith({
                where: { id: 'plan-1' },
                data: expect.objectContaining({ engineVersion: 'v1.0.0' }),
            });
        });
    });

    describe('finalize / reopen', () => {
        it('throws BadRequestException when finalizing an already FINALIZED plan', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'plan-1', patientId: 'patient-1', status: 'FINALIZED' });
            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(BadRequestException);
        });

        it('reopen throws BadRequestException when another DRAFT is already active', async () => {
            prisma.nutritionalPlan.findFirst
                .mockResolvedValueOnce({ id: 'plan-1', patientId: 'patient-1', status: 'FINALIZED' }) // verifyPlanOwnership
                .mockResolvedValueOnce({ id: 'other-draft', status: 'DRAFT' }); // active draft check
            await expect(service.reopen('user-1', 'patient-1', 'plan-1')).rejects.toThrow(BadRequestException);
        });
    });
});
