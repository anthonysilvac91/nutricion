import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ResultStatus } from '@prisma/client';
import { PlansService } from './plans.service';
import { MacroMethod } from './dto/recalculate-plan.dto';

function buildPrismaMock() {
    const tx = {
        $queryRaw: jest.fn(),
        patient: { findFirst: jest.fn() },
        assessment: { findFirst: jest.fn() },
        nutritionalPlan: {
            findFirst: jest.fn(),
            findFirstOrThrow: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
    };
    const prisma = {
        patient: { findFirst: jest.fn() },
        assessment: { findFirst: jest.fn() },
        nutritionalPlan: {
            findFirst: jest.fn(),
            findFirstOrThrow: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
        },
        // Supports both call shapes: a callback (interactive transaction, used by
        // recalculate/finalize/reopen) and an array of prisma promises (not used here, kept for safety).
        $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    };
    return { prisma, tx };
}

const COMPLETED_ASSESSMENT = {
    id: 'assessment-1',
    patientId: 'patient-1',
    status: 'COMPLETED',
    date: new Date('2026-01-01T12:00:00.000Z'),
    ageAtAssessmentMonths: 360,
    populationGroup: 'ADULT',
    measurements: [
        { definitionId: 'm_weight', numericValue: 65, stringValue: null },
        { definitionId: 'm_height', numericValue: 165, stringValue: null },
    ],
};

const PATIENT = { id: 'patient-1', userId: 'user-1', sex: 'FEMALE', activityLevel: 'MODERATE' };

const VALID_RECALCULATE_DTO = {
    bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
    pal: 1.55,
    macroMethod: MacroMethod.PERCENT,
    macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
    fiberSourceId: 'FIBER_IOM_V1',
    waterSourceId: 'WATER_IOM_V1',
} as any;

function fakeCalculationResults(overrides: Record<string, any> = {}) {
    const calculated = (metricId: string, extra: Record<string, any> = {}) => ({
        metricId, status: ResultStatus.CALCULATED, numericValue: 10, unit: 'unit',
        formulaUsed: 'FAKE_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0', ...extra,
    });
    return {
        CURRENT_BMI: calculated('CURRENT_BMI'),
        TARGET_BMI: calculated('TARGET_BMI'),
        WEIGHT_DIFFERENCE_KG: calculated('WEIGHT_DIFFERENCE_KG'),
        BMR: calculated('BMR'),
        TDEE: calculated('TDEE'),
        PROTEIN_G: calculated('PROTEIN_G', { metadataAsJson: { percent: 15, gPerKg: 0.5 } }),
        CARBS_G: calculated('CARBS_G', { metadataAsJson: { percent: 55, gPerKg: 1.5 } }),
        FAT_G: calculated('FAT_G', { metadataAsJson: { percent: 30, gPerKg: 0.8 } }),
        FIBER_G: calculated('FIBER_G'),
        WATER_ML: calculated('WATER_ML'),
        ...overrides,
    };
}

describe('PlansService', () => {
    let prisma: ReturnType<typeof buildPrismaMock>['prisma'];
    let tx: ReturnType<typeof buildPrismaMock>['tx'];
    let planCalculation: {
        calculate: jest.Mock;
        evaluateFinalizationReadiness: jest.Mock;
        describeCatalogChoice: jest.Mock;
    };
    let service: PlansService;

    beforeEach(() => {
        const mocks = buildPrismaMock();
        prisma = mocks.prisma;
        tx = mocks.tx;
        planCalculation = {
            calculate: jest.fn().mockReturnValue(fakeCalculationResults()),
            evaluateFinalizationReadiness: jest.fn().mockReturnValue({ canFinalize: true, finalizationBlockers: [] }),
            describeCatalogChoice: jest.fn().mockReturnValue(null),
        };
        service = new PlansService(prisma as any, planCalculation as any);
    });

    describe('findOne (ownership + DTO mapping)', () => {
        it('throws NotFoundException when userId does not match', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            await expect(service.findOne('other-user', 'patient-1', 'plan-1')).rejects.toThrow(NotFoundException);
            expect(prisma.nutritionalPlan.findFirst).toHaveBeenCalledWith({ where: { id: 'plan-1', patientId: 'patient-1', userId: 'other-user' } });
        });

        it('throws NotFoundException when the plan belongs to a different patient, even if userId matches', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            await expect(service.findOne('user-1', 'someone-elses-patient', 'plan-1')).rejects.toThrow(NotFoundException);
            expect(prisma.nutritionalPlan.findFirst).toHaveBeenCalledWith({ where: { id: 'plan-1', patientId: 'someone-elses-patient', userId: 'user-1' } });
        });

        it('maps a persisted plan row into the canonical DTO shape without recomputing clinical results', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: { assessmentId: 'assessment-1', date: '2026-01-01', populationGroup: 'ADULT', sex: 'FEMALE', ageYears: 30, activityLevel: 'MODERATE', measurementValues: { m_weight: 65, m_height: 165 } },
                config: VALID_RECALCULATE_DTO,
                calculationResults: fakeCalculationResults(),
                engineVersion: 'v1.0.0',
                createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const dto = await service.findOne('user-1', 'patient-1', 'plan-1');

            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(dto.id).toBe('plan-1');
            expect(dto.assessment).toEqual({ date: '2026-01-01', populationGroup: 'ADULT' });
            expect(dto.sourceValues).toEqual({ weightKg: 65, heightCm: 165, ageYears: 30, sex: 'FEMALE', activityLevel: 'MODERATE' });
            expect(dto.results.macros.protein).toEqual({ percentage: 15, grams: 10, gramsPerKg: 0.5, status: 'CALCULATED' });
            expect(dto.canFinalize).toBe(true);
            expect(dto.finalizationBlockers).toEqual([]);
        });
    });

    describe('createOrGetDraft', () => {
        it('throws NotFoundException when the patient does not belong to the user', async () => {
            prisma.patient.findFirst.mockResolvedValue(null);
            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(NotFoundException);
        });

        it('returns the existing draft without recomputing when it targets the same assessment', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            const existing = {
                id: 'plan-existing', status: 'DRAFT', assessmentId: 'assessment-1',
                sourceSnapshot: { measurementValues: {} }, config: {}, calculationResults: {},
            };
            prisma.nutritionalPlan.findFirst.mockResolvedValue(existing);

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);

            expect(result.id).toBe('plan-existing');
            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(prisma.assessment.findFirst).not.toHaveBeenCalled();
        });

        it('throws ConflictException (409) when an active DRAFT exists for a DIFFERENT assessmentId', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'plan-existing', status: 'DRAFT', assessmentId: 'assessment-OLD' });

            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-NEW' } as any)).rejects.toThrow(ConflictException);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
        });

        it('throws BadRequestException when the assessment is not COMPLETED', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue({ ...COMPLETED_ASSESSMENT, status: 'DRAFT' });

            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(BadRequestException);
        });

        it('throws BadRequestException when the assessment population is not ADULT', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue({ ...COMPLETED_ASSESSMENT, populationGroup: 'PEDIATRIC' });

            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(BadRequestException);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
        });

        it('builds a snapshot from the assessment and persists the computed calculationResults + config', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            prisma.nutritionalPlan.create.mockResolvedValue({
                id: 'new-plan', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: { measurementValues: { m_weight: 65, m_height: 165 } }, config: {}, calculationResults: fakeCalculationResults(),
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);

            expect(planCalculation.calculate).toHaveBeenCalledWith(
                expect.objectContaining({ assessmentId: 'assessment-1', sex: 'FEMALE', measurementValues: { m_weight: 65, m_height: 165 } }),
                expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55 }),
            );
            expect(prisma.nutritionalPlan.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'assessment-1', engineVersion: 'v1.0.0', config: expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1' }) }) }),
            );
            expect(result.id).toBe('new-plan');
        });

        it('handles a concurrent-create race (DB partial unique index) by returning the winning draft', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
            prisma.nutritionalPlan.create.mockRejectedValue(p2002);
            prisma.nutritionalPlan.findFirstOrThrow.mockResolvedValue({
                id: 'winning-draft', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: { measurementValues: {} }, config: {}, calculationResults: {},
            });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);
            expect(result.id).toBe('winning-draft');
        });

        it('the race winner having a different assessmentId still surfaces as 409, not a silent wrong bind', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
            prisma.nutritionalPlan.create.mockRejectedValue(p2002);
            prisma.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'winning-draft', assessmentId: 'assessment-OTHER', status: 'DRAFT' });

            await expect(service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any)).rejects.toThrow(ConflictException);
        });
    });

    describe('recalculate (locked, transactional)', () => {
        function mockLockRow(status: string | null, assessmentId = 'assessment-1') {
            tx.$queryRaw.mockResolvedValue(status ? [{ id: 'plan-1', status, assessmentId }] : []);
        }

        it('throws NotFoundException when the lock query finds no matching row (wrong owner/patient/id)', async () => {
            mockLockRow(null);
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO)).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException (409) when the plan is not a DRAFT (already finalized)', async () => {
            mockLockRow('FINALIZED');
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO)).rejects.toThrow(ConflictException);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(tx.nutritionalPlan.update).not.toHaveBeenCalled();
        });

        it('locks the row via FOR UPDATE, recomputes and persists calculationResults + config for a DRAFT plan', async () => {
            mockLockRow('DRAFT');
            tx.patient.findFirst.mockResolvedValue(PATIENT);
            tx.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            tx.nutritionalPlan.update.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: { measurementValues: {} }, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const result = await service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO);

            expect(tx.$queryRaw).toHaveBeenCalled();
            expect(planCalculation.calculate).toHaveBeenCalledWith(expect.objectContaining({ assessmentId: 'assessment-1' }), VALID_RECALCULATE_DTO);
            expect(tx.nutritionalPlan.update).toHaveBeenCalledWith({
                where: { id: 'plan-1' },
                data: expect.objectContaining({ engineVersion: 'v1.0.0', config: VALID_RECALCULATE_DTO }),
            });
            expect(result.id).toBe('plan-1');
        });
    });

    describe('finalize (locked, transactional, revalidated)', () => {
        function mockLockRow(status: string | null, assessmentId = 'assessment-1') {
            tx.$queryRaw.mockResolvedValue(status ? [{ id: 'plan-1', status, assessmentId }] : []);
        }

        it('throws NotFoundException when the lock query finds nothing', async () => {
            mockLockRow(null);
            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException (409) when the plan is already FINALIZED', async () => {
            mockLockRow('FINALIZED');
            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(ConflictException);
        });

        it('re-validates canFinalize inside the transaction and rejects with 400 + blockers when not ready', async () => {
            mockLockRow('DRAFT');
            tx.patient.findFirst.mockResolvedValue(PATIENT);
            tx.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'plan-1', config: VALID_RECALCULATE_DTO });
            planCalculation.evaluateFinalizationReadiness.mockReturnValue({
                canFinalize: false,
                finalizationBlockers: [{ code: 'MISSING_WEIGHT', field: 'weightKg', message: 'x' }],
            });

            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(BadRequestException);
            expect(tx.nutritionalPlan.updateMany).not.toHaveBeenCalled();
        });

        it('flips status to FINALIZED via a conditional updateMany when canFinalize is true', async () => {
            mockLockRow('DRAFT');
            tx.patient.findFirst.mockResolvedValue(PATIENT);
            tx.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            tx.nutritionalPlan.findFirstOrThrow
                .mockResolvedValueOnce({ id: 'plan-1', config: VALID_RECALCULATE_DTO }) // read config before computing
                .mockResolvedValueOnce({
                    id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'FINALIZED',
                    sourceSnapshot: { measurementValues: {} }, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                    engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: new Date(),
                });
            tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 1 });

            const result = await service.finalize('user-1', 'patient-1', 'plan-1');

            expect(tx.nutritionalPlan.updateMany).toHaveBeenCalledWith({
                where: { id: 'plan-1', status: 'DRAFT' },
                data: expect.objectContaining({ status: 'FINALIZED', finalizedAt: expect.any(Date) }),
            });
            expect(result.status).toBe('FINALIZED');
        });

        it('throws ConflictException when the conditional status flip affects 0 rows (lost a concurrent race)', async () => {
            mockLockRow('DRAFT');
            tx.patient.findFirst.mockResolvedValue(PATIENT);
            tx.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'plan-1', config: VALID_RECALCULATE_DTO });
            tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(ConflictException);
        });
    });

    describe('reopen (locked, transactional)', () => {
        function mockLockRow(status: string | null, assessmentId = 'assessment-1') {
            tx.$queryRaw.mockResolvedValue(status ? [{ id: 'plan-1', status, assessmentId }] : []);
        }

        it('throws ConflictException (409) when the plan is not FINALIZED (already a draft)', async () => {
            mockLockRow('DRAFT');
            await expect(service.reopen('user-1', 'patient-1', 'plan-1')).rejects.toThrow(ConflictException);
        });

        it('throws ConflictException (409) when another DRAFT is already active (DB partial unique index)', async () => {
            mockLockRow('FINALIZED');
            const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
            tx.nutritionalPlan.update.mockRejectedValue(p2002);

            await expect(service.reopen('user-1', 'patient-1', 'plan-1')).rejects.toThrow(ConflictException);
        });

        it('flips status back to DRAFT and clears finalizedAt', async () => {
            mockLockRow('FINALIZED');
            tx.nutritionalPlan.update.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: { measurementValues: {} }, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const result = await service.reopen('user-1', 'patient-1', 'plan-1');

            expect(tx.nutritionalPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { status: 'DRAFT', finalizedAt: null } });
            expect(result.status).toBe('DRAFT');
        });
    });
});
