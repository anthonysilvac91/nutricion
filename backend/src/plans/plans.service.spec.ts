import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, ResultStatus } from '@prisma/client';
import { PlansService } from './plans.service';
import { MacroMethod } from './dto/recalculate-plan.dto';
import { CalculationMetadata } from './plan-calculation.service';

function buildPrismaMock() {
    const tx = {
        $queryRaw: jest.fn(),
        patient: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
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
        // recalculate/finalize) and an array of prisma promises (not used here, kept for safety).
        $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
    };
    return { prisma, tx };
}

const PATIENT = { id: 'patient-1', userId: 'user-1', sex: 'FEMALE', activityLevel: 'MODERATE' };

// Shape returned by `assessment.findFirst({ include: { measurements: { include: { definition:
// true } }, results: true } })` -- what PlansService.loadCompletedAssessment/buildSnapshotV2
// actually consume.
const COMPLETED_ASSESSMENT = {
    id: 'assessment-1',
    patientId: 'patient-1',
    status: 'COMPLETED',
    date: new Date('2026-01-01T12:00:00.000Z'),
    completedAt: new Date('2026-01-01T13:00:00.000Z'),
    ageAtAssessmentMonths: 360,
    populationGroup: 'ADULT',
    measurements: [
        { id: 'rec-weight', definitionId: 'm_weight', numericValue: 65, stringValue: null, definition: { name: 'Peso', unit: 'kg' } },
        { id: 'rec-height', definitionId: 'm_height', numericValue: 165, stringValue: null, definition: { name: 'Estatura', unit: 'cm' } },
    ],
    results: [
        { metricId: 'BMI', numericValue: 23.9, stringValue: null, status: 'CALCULATED', formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0', statusCode: 'NORMAL', statusLabel: 'Normal' },
    ],
};

const V2_SNAPSHOT = {
    snapshotVersion: 'v2' as const,
    assessmentId: 'assessment-1',
    assessmentDate: '2026-01-01',
    assessmentCompletedAt: '2026-01-01T13:00:00.000Z',
    populationGroup: 'ADULT' as const,
    ageAtAssessmentMonths: 360,
    sex: 'FEMALE' as const,
    ageYears: 30,
    activityLevel: 'MODERATE',
    measurementValues: { m_weight: 65, m_height: 165 },
    measurements: [],
    assessmentResults: [],
};

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

function fakeCalculationMetadata(overrides: Partial<CalculationMetadata> = {}): CalculationMetadata {
    return {
        metadataVersion: 'v1',
        engineVersion: 'v1.0.0',
        calculatedAt: '2026-01-01T00:00:00.000Z',
        metrics: {
            CURRENT_BMI: { formulaId: 'FAKE_V1', formulaVersion: 'v1.0.0', reference: 'Fake reference', unit: 'unit' },
        },
        selectedSources: {
            bmrFormula: { id: 'BMR_HARRIS_BENEDICT_V1', version: 'v1.0.0', reference: 'Harris-Benedict reference' },
            fiberSource: { id: 'FIBER_IOM_V1', version: 'v1.0.0', reference: 'IOM reference' },
            waterSource: { id: 'WATER_IOM_V1', version: 'v1.0.0', reference: 'IOM water reference' },
        },
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
        buildCalculationMetadata: jest.Mock;
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
            buildCalculationMetadata: jest.fn().mockReturnValue(fakeCalculationMetadata()),
        };
        service = new PlansService(prisma as any, planCalculation as any);
    });

    it('does not expose a reopen method -- FINALIZED is permanently immutable, there is no path back to DRAFT', () => {
        expect((service as any).reopen).toBeUndefined();
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

        it('maps a persisted plan row into the canonical DTO shape without recomputing clinical results or calling the registry', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: V2_SNAPSHOT,
                config: VALID_RECALCULATE_DTO,
                calculationResults: fakeCalculationResults(),
                calculationMetadata: fakeCalculationMetadata(),
                calculatedAt: new Date('2026-01-01T00:00:00.000Z'),
                engineVersion: 'v1.0.0',
                createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const dto = await service.findOne('user-1', 'patient-1', 'plan-1');

            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(planCalculation.describeCatalogChoice).not.toHaveBeenCalled();
            expect(dto.id).toBe('plan-1');
            expect(dto.assessment).toEqual({ date: '2026-01-01', populationGroup: 'ADULT' });
            expect(dto.sourceValues).toEqual({ weightKg: 65, heightCm: 165, ageYears: 30, sex: 'FEMALE', activityLevel: 'MODERATE' });
            expect(dto.results.macros.protein).toEqual({ percentage: 15, grams: 10, gramsPerKg: 0.5, status: 'CALCULATED' });
            expect(dto.results.currentBmi?.reference).toBe('Fake reference');
            expect(dto.calculationMetadata).toEqual({
                engineVersion: 'v1.0.0',
                bmrFormula: { id: 'BMR_HARRIS_BENEDICT_V1', version: 'v1.0.0', reference: 'Harris-Benedict reference' },
                fiberSource: { id: 'FIBER_IOM_V1', version: 'v1.0.0', reference: 'IOM reference' },
                waterSource: { id: 'WATER_IOM_V1', version: 'v1.0.0', reference: 'IOM water reference' },
            });
            expect(dto.canFinalize).toBe(true);
            expect(dto.finalizationBlockers).toEqual([]);
        });

        it('a simulated registry change never alters a FINALIZED plan\'s displayed reference -- it always reads the frozen calculationMetadata', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'FINALIZED',
                sourceSnapshot: V2_SNAPSHOT,
                config: VALID_RECALCULATE_DTO,
                calculationResults: fakeCalculationResults(),
                calculationMetadata: fakeCalculationMetadata({
                    metrics: { CURRENT_BMI: { formulaId: 'FAKE_V1', formulaVersion: 'v1.0.0', reference: 'ORIGINAL frozen reference', unit: 'unit' } },
                }),
                calculatedAt: new Date(), engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: new Date(),
            });
            // Simulates the registry having since changed -- mapToDto must never call this for a GET.
            planCalculation.describeCatalogChoice.mockReturnValue({ id: 'FAKE_V1', version: 'v2.0.0', reference: 'A DIFFERENT reference after a later formula update' });

            const dto = await service.findOne('user-1', 'patient-1', 'plan-1');

            expect(dto.results.currentBmi?.reference).toBe('ORIGINAL frozen reference');
            expect(planCalculation.describeCatalogChoice).not.toHaveBeenCalled();
        });

        it('legacy rows created before calculationMetadata existed return calculationMetadata: null, never a live reconstruction', async () => {
            prisma.nutritionalPlan.findFirst.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'FINALIZED',
                sourceSnapshot: { assessmentId: 'assessment-1', date: '2026-01-01', populationGroup: 'ADULT', sex: 'FEMALE', ageYears: 30, activityLevel: 'MODERATE', measurementValues: { m_weight: 65, m_height: 165 } },
                config: VALID_RECALCULATE_DTO,
                calculationResults: fakeCalculationResults(),
                calculationMetadata: null,
                calculatedAt: null,
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: new Date(),
            });

            const dto = await service.findOne('user-1', 'patient-1', 'plan-1');

            expect(dto.calculationMetadata).toBeNull();
            expect(dto.results.currentBmi?.reference).toBeNull();
            // Legacy pre-v2 snapshot still displays its date via the old `date` key fallback.
            expect(dto.assessment.date).toBe('2026-01-01');
            expect(planCalculation.describeCatalogChoice).not.toHaveBeenCalled();
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
                sourceSnapshot: V2_SNAPSHOT, config: {}, calculationResults: {}, calculationMetadata: null,
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

        it('builds a v2 snapshot from the assessment and persists sourceSnapshot + calculationResults + calculationMetadata + config, all in one write', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            prisma.nutritionalPlan.create.mockResolvedValue({
                id: 'new-plan', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: V2_SNAPSHOT, config: {}, calculationResults: fakeCalculationResults(), calculationMetadata: fakeCalculationMetadata(),
                calculatedAt: new Date(), engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);

            expect(planCalculation.calculate).toHaveBeenCalledWith(
                expect.objectContaining({
                    snapshotVersion: 'v2',
                    assessmentId: 'assessment-1',
                    assessmentDate: '2026-01-01',
                    sex: 'FEMALE',
                    measurementValues: { m_weight: 65, m_height: 165 },
                    measurements: expect.arrayContaining([
                        expect.objectContaining({ definitionId: 'm_weight', name: 'Peso', unit: 'kg', numericValue: 65 }),
                    ]),
                    assessmentResults: expect.arrayContaining([expect.objectContaining({ metricId: 'BMI' })]),
                }),
                expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55 }),
            );
            expect(planCalculation.buildCalculationMetadata).toHaveBeenCalled();
            expect(prisma.nutritionalPlan.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        assessmentId: 'assessment-1',
                        engineVersion: 'v1.0.0',
                        config: expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1' }),
                        sourceSnapshot: expect.objectContaining({ snapshotVersion: 'v2' }),
                        calculationMetadata: expect.any(Object),
                        calculatedAt: expect.any(Date),
                    }),
                }),
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
                sourceSnapshot: V2_SNAPSHOT, config: {}, calculationResults: {}, calculationMetadata: null,
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

    describe('recalculate (locked, transactional, frozen snapshot)', () => {
        function mockLockRow(status: string | null, assessmentId = 'assessment-1') {
            tx.$queryRaw.mockResolvedValue(status ? [{ id: 'plan-1', status, assessmentId }] : []);
        }

        it('throws NotFoundException when the lock query finds no matching row (wrong owner/patient/id)', async () => {
            mockLockRow(null);
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO)).rejects.toThrow(NotFoundException);
        });

        it('throws ConflictException (409) when the plan is not a DRAFT (already finalized) -- FINALIZED cannot be recalculated', async () => {
            mockLockRow('FINALIZED');
            await expect(service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO)).rejects.toThrow(ConflictException);
            expect(planCalculation.calculate).not.toHaveBeenCalled();
            expect(tx.nutritionalPlan.update).not.toHaveBeenCalled();
        });

        it('an already-v2 snapshot: recalculates using exclusively the persisted snapshot, never re-querying Patient/Assessment, and never rewrites sourceSnapshot', async () => {
            mockLockRow('DRAFT');
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', sourceSnapshot: V2_SNAPSHOT,
            });
            tx.nutritionalPlan.update.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                calculationMetadata: fakeCalculationMetadata(), calculatedAt: new Date(),
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            const result = await service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO);

            expect(tx.$queryRaw).toHaveBeenCalled();
            expect(planCalculation.calculate).toHaveBeenCalledWith(V2_SNAPSHOT, VALID_RECALCULATE_DTO);
            expect(tx.patient.findFirstOrThrow).not.toHaveBeenCalled();
            expect(tx.assessment.findFirst).not.toHaveBeenCalled();
            expect(planCalculation.buildCalculationMetadata).toHaveBeenCalledWith(expect.any(Object), VALID_RECALCULATE_DTO);

            const updateCall = tx.nutritionalPlan.update.mock.calls[0][0];
            expect(updateCall).toEqual({
                where: { id: 'plan-1' },
                data: expect.objectContaining({ engineVersion: 'v1.0.0', config: VALID_RECALCULATE_DTO, calculatedAt: expect.any(Date) }),
            });
            // The whole point of freezing the snapshot: an already-v2 snapshot is never
            // re-included in the update payload, even with identical content.
            expect(updateCall.data.sourceSnapshot).toBeUndefined();
            expect(result.id).toBe('plan-1');
        });

        it('a legacy (pre-v2) DRAFT snapshot is upgraded exactly once, inside the same lock, by rebuilding it from the still-referenced Assessment', async () => {
            mockLockRow('DRAFT');
            const legacySnapshot = { assessmentId: 'assessment-1', date: '2026-01-01', populationGroup: 'ADULT', sex: 'FEMALE', ageYears: 30, activityLevel: 'MODERATE', measurementValues: { m_weight: 65, m_height: 165 } };
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', sourceSnapshot: legacySnapshot,
            });
            tx.patient.findFirstOrThrow.mockResolvedValue(PATIENT);
            tx.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            tx.nutritionalPlan.update.mockResolvedValue({
                id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'DRAFT',
                sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                calculationMetadata: fakeCalculationMetadata(), calculatedAt: new Date(),
                engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: null,
            });

            await service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO);

            expect(tx.patient.findFirstOrThrow).toHaveBeenCalledWith({ where: { id: 'patient-1' } });
            expect(tx.assessment.findFirst).toHaveBeenCalled();
            const updateCall = tx.nutritionalPlan.update.mock.calls[0][0];
            // The upgrade IS persisted this one time -- and calculate() ran against the rebuilt v2 shape.
            expect(updateCall.data.sourceSnapshot).toEqual(expect.objectContaining({ snapshotVersion: 'v2', assessmentDate: '2026-01-01' }));
            expect(planCalculation.calculate).toHaveBeenCalledWith(expect.objectContaining({ snapshotVersion: 'v2' }), VALID_RECALCULATE_DTO);
        });
    });

    describe('finalize (locked, transactional, revalidated, snapshot never rewritten)', () => {
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

        it('re-validates canFinalize inside the transaction, using the persisted snapshot, and rejects with 400 + blockers when not ready', async () => {
            mockLockRow('DRAFT');
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'plan-1', sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO });
            planCalculation.evaluateFinalizationReadiness.mockReturnValue({
                canFinalize: false,
                finalizationBlockers: [{ code: 'MISSING_WEIGHT', field: 'weightKg', message: 'x' }],
            });

            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(BadRequestException);
            expect(tx.nutritionalPlan.updateMany).not.toHaveBeenCalled();
            expect(tx.patient.findFirstOrThrow).not.toHaveBeenCalled();
            expect(tx.assessment.findFirst).not.toHaveBeenCalled();
        });

        it('flips status to FINALIZED via a conditional updateMany, persists calculationMetadata/calculatedAt, and never touches sourceSnapshot', async () => {
            mockLockRow('DRAFT');
            tx.nutritionalPlan.findFirstOrThrow
                .mockResolvedValueOnce({ id: 'plan-1', sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO }) // read before computing
                .mockResolvedValueOnce({
                    id: 'plan-1', patientId: 'patient-1', assessmentId: 'assessment-1', status: 'FINALIZED',
                    sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO, calculationResults: fakeCalculationResults(),
                    calculationMetadata: fakeCalculationMetadata(), calculatedAt: new Date(),
                    engineVersion: 'v1.0.0', createdAt: new Date(), updatedAt: new Date(), finalizedAt: new Date(),
                });
            tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 1 });

            const result = await service.finalize('user-1', 'patient-1', 'plan-1');

            expect(planCalculation.calculate).toHaveBeenCalledWith(V2_SNAPSHOT, VALID_RECALCULATE_DTO);
            expect(tx.patient.findFirstOrThrow).not.toHaveBeenCalled();
            expect(tx.assessment.findFirst).not.toHaveBeenCalled();
            const updateManyCall = tx.nutritionalPlan.updateMany.mock.calls[0][0];
            expect(updateManyCall.where).toEqual({ id: 'plan-1', status: 'DRAFT' });
            expect(updateManyCall.data).toEqual(expect.objectContaining({ status: 'FINALIZED', finalizedAt: expect.any(Date), calculatedAt: expect.any(Date) }));
            expect(updateManyCall.data.sourceSnapshot).toBeUndefined();
            expect(result.status).toBe('FINALIZED');
        });

        it('throws ConflictException when the conditional status flip affects 0 rows (lost a concurrent race)', async () => {
            mockLockRow('DRAFT');
            tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'plan-1', sourceSnapshot: V2_SNAPSHOT, config: VALID_RECALCULATE_DTO });
            tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 0 });

            await expect(service.finalize('user-1', 'patient-1', 'plan-1')).rejects.toThrow(ConflictException);
        });
    });

    // Corte 4: las rutas legacy (userId-scoped) nunca deben poder mutar un
    // NutritionalPlan ligado a un ClinicalEncounter -- ver lockPlanRow.
    describe('legacy routes cannot mutate a Plan linked to a ClinicalEncounter (corte 4)', () => {
        function mockLockRowLinkedToEncounter(status = 'DRAFT') {
            tx.$queryRaw.mockResolvedValue([{ id: 'plan-1', status, assessmentId: 'assessment-1', encounterId: 'enc-1' }]);
        }

        it('recalculate rejects with 409 PLAN_LINKED_TO_ENCOUNTER', async () => {
            mockLockRowLinkedToEncounter();
            try {
                await service.recalculate('user-1', 'patient-1', 'plan-1', VALID_RECALCULATE_DTO);
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('PLAN_LINKED_TO_ENCOUNTER');
            }
            expect(tx.nutritionalPlan.update).not.toHaveBeenCalled();
        });

        it('finalize rejects with 409 PLAN_LINKED_TO_ENCOUNTER', async () => {
            mockLockRowLinkedToEncounter();
            try {
                await service.finalize('user-1', 'patient-1', 'plan-1');
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('PLAN_LINKED_TO_ENCOUNTER');
            }
            expect(tx.nutritionalPlan.updateMany).not.toHaveBeenCalled();
        });

        it('createOrGetDraft rejects with 409 PLAN_LINKED_TO_ENCOUNTER when the patient active DRAFT belongs to a consultation', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'plan-existing', status: 'DRAFT', assessmentId: 'assessment-1', encounterId: 'enc-1' });

            try {
                await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('PLAN_LINKED_TO_ENCOUNTER');
            }
        });

        it('resolves a P2002 race against an ENCOUNTER-LINKED winner with 409 PLAN_LINKED_TO_ENCOUNTER -- never returns it, even under a race', async () => {
            prisma.patient.findFirst.mockResolvedValue(PATIENT);
            prisma.nutritionalPlan.findFirst.mockResolvedValue(null);
            prisma.assessment.findFirst.mockResolvedValue(COMPLETED_ASSESSMENT);
            const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
            prisma.nutritionalPlan.create.mockRejectedValue(p2002);
            prisma.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'winner-encounter', assessmentId: 'assessment-1', status: 'DRAFT', encounterId: 'enc-1' });

            try {
                await service.createOrGetDraft('user-1', 'patient-1', { assessmentId: 'assessment-1' } as any);
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('PLAN_LINKED_TO_ENCOUNTER');
            }
        });
    });
});
