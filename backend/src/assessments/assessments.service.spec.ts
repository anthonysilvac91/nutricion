import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContextResolverService } from './context-resolver.service';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';

describe('AssessmentsService', () => {
    let service: AssessmentsService;
    let prisma: any;
    let tx: any;
    let contextResolver: { resolveContext: jest.Mock };
    let engine: { calculateAll: jest.Mock };

    beforeEach(async () => {
        // Shared mock for the interactive-transaction client. lockDraftAssessment and every
        // DRAFT-mutating operation read/write through this object exclusively.
        tx = {
            $queryRaw: jest.fn(),
            patient: { findFirstOrThrow: jest.fn() },
            measurementDefinition: { findMany: jest.fn() },
            assessment: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
            measurementRecord: { createMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
            calculatedResult: { deleteMany: jest.fn(), createMany: jest.fn() },
        };

        prisma = {
            patient: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
            measurementDefinition: { findMany: jest.fn() },
            assessment: {
                create: jest.fn(),
                findFirst: jest.fn(),
                findFirstOrThrow: jest.fn(),
                findMany: jest.fn(),
            },
            measurementRecord: { createMany: jest.fn() },
            calculatedResult: { createMany: jest.fn() },
            // Supports both call shapes: a callback (interactive transaction, used by
            // upsertMeasurements/removeMeasurement/complete/create) and an array of prisma
            // promises (batch transaction, not used anymore but kept for safety).
            $transaction: jest.fn((arg) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
        };
        contextResolver = { resolveContext: jest.fn() };
        engine = { calculateAll: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AssessmentsService,
                { provide: PrismaService, useValue: prisma },
                { provide: ContextResolverService, useValue: contextResolver },
                { provide: ClinicalCalculationEngineService, useValue: engine },
            ],
        }).compile();

        service = module.get<AssessmentsService>(AssessmentsService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create (legacy endpoint)', () => {
        const patient = {
            id: 'patient-1',
            userId: 'user-1',
            birthDate: new Date('1990-01-01T00:00:00.000Z'),
            sex: 'MALE',
            activityLevel: 'MODERATE',
        };

        beforeEach(() => {
            prisma.patient.findFirst.mockResolvedValue(patient);
            prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight' }]);
            contextResolver.resolveContext.mockReturnValue({
                ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD',
            });
            engine.calculateAll.mockReturnValue([]);
            tx.assessment.create.mockResolvedValue({ id: 'assessment-1' });
            prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', date: new Date('2026-03-01T12:00:00.000Z'), measurements: [], results: [] });
        });

        it('filters patient ownership before creating an assessment', async () => {
            await service.create('user-1', 'patient-1', {
                date: '2026-03-01T10:00:00.000Z',
                measurements: [{ definitionId: 'm_weight', numericValue: 80 }],
            });

            expect(prisma.patient.findFirst).toHaveBeenCalledWith({ where: { id: 'patient-1', userId: 'user-1' } });
        });

        it('always creates the assessment as COMPLETED with completedAt, never a DRAFT', async () => {
            await service.create('user-1', 'patient-1', {
                date: '2026-03-01T10:00:00.000Z',
                measurements: [{ definitionId: 'm_weight', numericValue: 80 }],
            });

            expect(tx.assessment.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
            }));
        });

        it('rejects a measurement with neither numericValue nor stringValue', async () => {
            await expect(
                service.create('user-1', 'patient-1', { date: '2026-03-01T10:00:00.000Z', measurements: [{ definitionId: 'm_weight' } as any] }),
            ).rejects.toThrow('Each measurement requires a numericValue or stringValue');
        });

        it('rejects numericValue and stringValue provided simultaneously', async () => {
            await expect(
                service.create('user-1', 'patient-1', {
                    date: '2026-03-01T10:00:00.000Z',
                    measurements: [{ definitionId: 'm_weight', numericValue: 80, stringValue: 'eighty' } as any],
                }),
            ).rejects.toThrow('cannot have both numericValue and stringValue');
        });

        it.each([NaN, Infinity, -Infinity])('rejects a non-finite numericValue (%p)', async (bad) => {
            await expect(
                service.create('user-1', 'patient-1', { date: '2026-03-01T10:00:00.000Z', measurements: [{ definitionId: 'm_weight', numericValue: bad }] }),
            ).rejects.toThrow('numericValue must be a finite number');
        });

        it('rejects a definitionId that does not exist or is inactive', async () => {
            prisma.measurementDefinition.findMany.mockResolvedValue([]);
            await expect(
                service.create('user-1', 'patient-1', { date: '2026-03-01T10:00:00.000Z', measurements: [{ definitionId: 'm_unknown', numericValue: 1 }] }),
            ).rejects.toThrow('do not exist or are inactive');
        });
    });

    it('filters assessment reads by patient owner', async () => {
        prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', date: new Date('2026-03-01T12:00:00.000Z'), measurements: [], results: [] });
        await service.findOne('user-1', 'assessment-1');
        expect(prisma.assessment.findFirst).toHaveBeenCalledWith({
            where: { id: 'assessment-1', patient: { userId: 'user-1' } },
            include: { measurements: true, results: true },
        });
    });

    it('filters latest patient assessment reads by patient owner', async () => {
        prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
        prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', date: new Date('2026-03-01T12:00:00.000Z'), measurements: [], results: [] });
        await service.findLatestByPatient('user-1', 'patient-1');
        expect(prisma.assessment.findFirst).toHaveBeenCalledWith({
            where: { patientId: 'patient-1' },
            orderBy: { date: 'desc' },
            include: { measurements: true, results: true },
        });
    });

    it('throws not found before latest read when patient is not owned', async () => {
        prisma.patient.findFirst.mockResolvedValue(null);
        await expect(service.findLatestByPatient('user-1', 'patient-1')).rejects.toThrow('Patient not found');
        expect(prisma.assessment.findFirst).not.toHaveBeenCalled();
    });

    describe('createOrGetDraft', () => {
        it('throws NotFoundException when the patient is not owned by the user', async () => {
            prisma.patient.findFirst.mockResolvedValue(null);
            await expect(service.createOrGetDraft('user-1', 'patient-1', {})).rejects.toThrow(NotFoundException);
        });

        it('returns the existing DRAFT without creating a new one', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.assessment.findFirst
                .mockResolvedValueOnce({ id: 'draft-1', status: 'DRAFT' })
                .mockResolvedValueOnce({ id: 'draft-1', date: new Date('2026-07-26T12:00:00.000Z'), measurements: [], results: [] });

            const result = await service.createOrGetDraft('user-1', 'patient-1', {});
            expect(prisma.assessment.create).not.toHaveBeenCalled();
            expect(result.id).toBe('draft-1');
        });

        it('creates a new DRAFT anchored at noon UTC for the given clinical date, and returns that exact date as a string', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.assessment.findFirst.mockResolvedValueOnce(null); // no existing DRAFT
            prisma.assessment.create.mockResolvedValue({ id: 'draft-2' });
            prisma.assessment.findFirst.mockResolvedValueOnce({ id: 'draft-2', date: new Date('2026-07-26T12:00:00.000Z'), measurements: [], results: [] });

            const result = await service.createOrGetDraft('user-1', 'patient-1', { date: '2026-07-26' });

            expect(prisma.assessment.create).toHaveBeenCalledWith({
                data: { patientId: 'patient-1', date: new Date('2026-07-26T12:00:00.000Z'), status: 'DRAFT' },
            });
            expect(result.date).toBe('2026-07-26');
        });
    });

    // Corte 3: las rutas legacy (userId-scoped) nunca deben poder mutar un
    // Assessment ligado a un ClinicalEncounter -- ver lockDraftAssessment.
    describe('legacy routes cannot mutate an Assessment linked to a ClinicalEncounter', () => {
        function mockLockRowLinkedToEncounter() {
            tx.$queryRaw.mockResolvedValue([{ id: 'assessment-1', status: 'DRAFT', encounterId: 'enc-1' }]);
        }

        it('upsertMeasurements rejects with 409 ASSESSMENT_LINKED_TO_ENCOUNTER', async () => {
            mockLockRowLinkedToEncounter();
            try {
                await service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', { measurements: [{ definitionId: 'm_weight', numericValue: 70 }] });
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('ASSESSMENT_LINKED_TO_ENCOUNTER');
            }
            expect(tx.measurementRecord.upsert).not.toHaveBeenCalled();
        });

        it('removeMeasurement rejects with 409 ASSESSMENT_LINKED_TO_ENCOUNTER', async () => {
            mockLockRowLinkedToEncounter();
            await expect(service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight')).rejects.toThrow(ConflictException);
            expect(tx.measurementRecord.deleteMany).not.toHaveBeenCalled();
        });

        it('complete rejects with 409 ASSESSMENT_LINKED_TO_ENCOUNTER', async () => {
            mockLockRowLinkedToEncounter();
            await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(ConflictException);
            expect(tx.calculatedResult.deleteMany).not.toHaveBeenCalled();
        });

        it('createOrGetDraft rejects with 409 ASSESSMENT_LINKED_TO_ENCOUNTER when the patient active DRAFT belongs to a consultation', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.assessment.findFirst.mockResolvedValue({ id: 'draft-1', status: 'DRAFT', encounterId: 'enc-1' });

            try {
                await service.createOrGetDraft('user-1', 'patient-1', {});
                fail('expected to throw');
            } catch (e: any) {
                expect(e).toBeInstanceOf(ConflictException);
                expect(e.getResponse().code).toBe('ASSESSMENT_LINKED_TO_ENCOUNTER');
            }
        });
    });

    describe('locking (Fase 1 -- atomicity)', () => {
        function mockLockRow(status: string | null) {
            tx.$queryRaw.mockResolvedValue(status ? [{ id: 'assessment-1', status }] : []);
        }

        describe('upsertMeasurements', () => {
            const dto = { measurements: [{ definitionId: 'm_weight', numericValue: 70 }] };

            it('throws NotFoundException when the lock query finds no matching row (wrong owner/patient/id)', async () => {
                mockLockRow(null);
                await expect(service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', dto)).rejects.toThrow(NotFoundException);
            });

            it('throws ConflictException when the assessment is no longer DRAFT (lost the race or already completed)', async () => {
                mockLockRow('COMPLETED');
                await expect(service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', dto)).rejects.toThrow(ConflictException);
                expect(tx.measurementRecord.upsert).not.toHaveBeenCalled();
            });

            it('locks the row via FOR UPDATE, then upserts each measurement through the same tx client', async () => {
                mockLockRow('DRAFT');
                tx.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight' }]);
                tx.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', date: new Date('2026-07-26T12:00:00.000Z'), measurements: [{ definitionId: 'm_weight' }], results: [] });

                const result = await service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', dto);

                expect(tx.$queryRaw).toHaveBeenCalled();
                expect(tx.measurementRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
                    where: { assessmentId_definitionId: { assessmentId: 'assessment-1', definitionId: 'm_weight' } },
                }));
                expect(result.id).toBe('assessment-1');
            });

            it('rejects a definitionId that is not active in the catalog', async () => {
                mockLockRow('DRAFT');
                tx.measurementDefinition.findMany.mockResolvedValue([]);
                await expect(service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', dto)).rejects.toThrow('do not exist or are inactive');
                expect(tx.measurementRecord.upsert).not.toHaveBeenCalled();
            });

            it('rejects duplicate definitionId within the same payload before even locking', async () => {
                await expect(
                    service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', {
                        measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_weight', numericValue: 71 }],
                    }),
                ).rejects.toThrow('Duplicate measurement definitions');
                expect(tx.$queryRaw).not.toHaveBeenCalled();
            });
        });

        describe('removeMeasurement', () => {
            it('throws ConflictException when the assessment is COMPLETED', async () => {
                mockLockRow('COMPLETED');
                await expect(service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight')).rejects.toThrow(ConflictException);
                expect(tx.measurementRecord.deleteMany).not.toHaveBeenCalled();
            });

            it('throws NotFoundException when the measurement is not part of the draft', async () => {
                mockLockRow('DRAFT');
                tx.measurementRecord.deleteMany.mockResolvedValue({ count: 0 });
                await expect(service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight')).rejects.toThrow(NotFoundException);
            });

            it('deletes the measurement through the locked tx and returns the updated assessment', async () => {
                mockLockRow('DRAFT');
                tx.measurementRecord.deleteMany.mockResolvedValue({ count: 1 });
                tx.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', date: new Date('2026-07-26T12:00:00.000Z'), measurements: [], results: [] });

                const result = await service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight');
                expect(tx.measurementRecord.deleteMany).toHaveBeenCalledWith({ where: { assessmentId: 'assessment-1', definitionId: 'm_weight' } });
                expect(result.id).toBe('assessment-1');
            });
        });

        describe('complete', () => {
            const draftWithMeasurements = {
                id: 'assessment-1',
                status: 'DRAFT',
                date: new Date('2026-07-26T00:00:00.000Z'),
                measurements: [
                    { definitionId: 'm_weight', numericValue: 70, stringValue: null },
                    { definitionId: 'm_height', numericValue: 175, stringValue: null },
                ],
            };

            it('throws NotFoundException when the lock query finds nothing', async () => {
                mockLockRow(null);
                await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(NotFoundException);
            });

            it('throws ConflictException when the assessment is already COMPLETED', async () => {
                mockLockRow('COMPLETED');
                await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(ConflictException);
                expect(tx.calculatedResult.deleteMany).not.toHaveBeenCalled();
            });

            it('throws BadRequestException when the draft has no measurements', async () => {
                mockLockRow('DRAFT');
                tx.assessment.findFirst.mockResolvedValue({ ...draftWithMeasurements, measurements: [] });
                await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow('At least one measurement is required');
            });

            it('runs the engine, replaces CalculatedResult, and flips status via a conditional updateMany', async () => {
                mockLockRow('DRAFT');
                tx.assessment.findFirst
                    .mockResolvedValueOnce(draftWithMeasurements) // read inside complete()
                    .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', date: draftWithMeasurements.date, measurements: [], results: [] }); // final re-read
                tx.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
                contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
                engine.calculateAll.mockReturnValue([{ metricId: 'BMI', status: 'CALCULATED', numericValue: 22.8, formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' }]);
                tx.assessment.updateMany.mockResolvedValue({ count: 1 });

                await service.complete('user-1', 'patient-1', 'assessment-1');

                expect(tx.calculatedResult.deleteMany).toHaveBeenCalledWith({ where: { assessmentId: 'assessment-1' } });
                expect(tx.calculatedResult.createMany).toHaveBeenCalled();
                expect(tx.assessment.updateMany).toHaveBeenCalledWith({
                    where: { id: 'assessment-1', status: 'DRAFT' },
                    data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
                });
            });

            it('returns the clinical date unchanged as a YYYY-MM-DD string, never touching it on completion', async () => {
                mockLockRow('DRAFT');
                tx.assessment.findFirst
                    .mockResolvedValueOnce(draftWithMeasurements)
                    .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', date: draftWithMeasurements.date, measurements: [], results: [] });
                tx.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
                contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
                engine.calculateAll.mockReturnValue([{ metricId: 'BMI', status: 'CALCULATED', numericValue: 22.8, formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' }]);
                tx.assessment.updateMany.mockResolvedValue({ count: 1 });

                const result = await service.complete('user-1', 'patient-1', 'assessment-1');

                expect(result.date).toBe('2026-07-26');
                expect(tx.assessment.updateMany.mock.calls[0][0].data.date).toBeUndefined();
            });

            it('throws ConflictException without duplicating results when the conditional status flip affects 0 rows', async () => {
                mockLockRow('DRAFT');
                tx.assessment.findFirst.mockResolvedValueOnce(draftWithMeasurements);
                tx.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
                contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
                engine.calculateAll.mockReturnValue([{ metricId: 'BMI', status: 'CALCULATED', numericValue: 22.8, formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' }]);
                tx.assessment.updateMany.mockResolvedValue({ count: 0 });

                await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(ConflictException);
                // createMany was still called once (inside this tx, which the DB would roll back on
                // throw) -- the point of this test is that our code detects count===0 and throws
                // rather than silently returning a "completed" assessment, not that createMany was
                // never invoked (that's Postgres's job via transaction rollback, proven by the e2e).
                expect(tx.calculatedResult.createMany).toHaveBeenCalledTimes(1);
            });

            it('completes even when weight/height are missing, letting the engine report MISSING_DATA', async () => {
                mockLockRow('DRAFT');
                tx.assessment.findFirst
                    .mockResolvedValueOnce({ ...draftWithMeasurements, measurements: [{ definitionId: 'm_waist', numericValue: 80, stringValue: null }] })
                    .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', date: draftWithMeasurements.date, measurements: [], results: [] });
                tx.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
                contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
                engine.calculateAll.mockReturnValue([{ metricId: 'BMI', status: 'MISSING_DATA', formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' }]);
                tx.assessment.updateMany.mockResolvedValue({ count: 1 });

                await expect(service.complete('user-1', 'patient-1', 'assessment-1')).resolves.toBeDefined();
            });
        });
    });
});
