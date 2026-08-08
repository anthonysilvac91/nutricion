import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EncounterAssessmentService } from './encounter-assessment.service';

function buildMocks() {
  const tx = {
    $queryRaw: jest.fn(),
    assessment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    measurementRecord: { upsert: jest.fn(), deleteMany: jest.fn() },
    calculatedResult: { deleteMany: jest.fn(), createMany: jest.fn() },
    patient: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'patient-1', sex: 'FEMALE', activityLevel: 'MODERATE' }) },
  };
  const prisma = {
    clinicalEncounter: { findFirst: jest.fn() },
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const encounters = {
    lockEncounterForWrite: jest.fn(),
    reconcileMeasurementsModule: jest.fn(),
  };
  const assessments = {
    mapToUiResponse: jest.fn((a: any) => ({ mapped: true, ...a })),
    validateMeasurementsShape: jest.fn(),
    assertDefinitionsUsable: jest.fn(),
    buildCalculatedResultRows: jest.fn((assessmentId: string, results: any[]) => results.map((r) => ({ assessmentId, ...r }))),
  };
  const contextResolver = { resolveContext: jest.fn().mockReturnValue({ ageAtAssessmentMonths: 360, populationGroup: 'ADULT' }) };
  const engine = { calculateAll: jest.fn().mockReturnValue([]) };
  return { prisma, tx, encounters, assessments, contextResolver, engine };
}

const CLINICAL_DATE = new Date('2026-08-04T12:00:00.000Z');
const IN_PROGRESS_ENCOUNTER = { id: 'enc-1', status: 'IN_PROGRESS', clinicalDate: CLINICAL_DATE };

describe('EncounterAssessmentService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: EncounterAssessmentService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new EncounterAssessmentService(
      mocks.prisma as any,
      mocks.encounters as any,
      mocks.assessments as any,
      mocks.contextResolver as any,
      mocks.engine as any,
    );
  });

  describe('createOrGet', () => {
    it('creates a DRAFT Assessment when the encounter has none, using encounter.clinicalDate (never new Date() or a client-supplied date)', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.assessment.findUnique.mockResolvedValue(null); // sin Assessment para este encounter
      mocks.tx.assessment.findFirst.mockResolvedValue(null); // sin DRAFT standalone ni de otro encounter
      mocks.tx.assessment.create.mockResolvedValue({ id: 'assessment-1' });
      mocks.tx.assessment.findUniqueOrThrow.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT', measurements: [], results: [] });

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.tx.assessment.create).toHaveBeenCalledWith({
        data: { patientId: 'patient-1', encounterId: 'enc-1', date: CLINICAL_DATE, status: 'DRAFT' },
      });
      expect(mocks.encounters.reconcileMeasurementsModule).toHaveBeenCalledWith(mocks.tx, 'enc-1', 'IN_PROGRESS', null);
      expect(result.id).toBe('assessment-1');
    });

    it('is idempotent: calling it again for the same encounter returns the same Assessment without creating a new one', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.assessment.findUnique.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT', measurements: [], results: [] });

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.tx.assessment.create).not.toHaveBeenCalled();
      expect(result.id).toBe('assessment-1');
    });

    it('two concurrent creates resolve to a single Assessment via the P2002 race path (belt-and-suspenders on top of the row lock)', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.assessment.findUnique.mockResolvedValue(null);
      mocks.tx.assessment.findFirst.mockResolvedValue(null);
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      mocks.tx.assessment.create.mockRejectedValue(p2002);
      mocks.tx.assessment.findUniqueOrThrow.mockResolvedValue({ id: 'winning-assessment', status: 'DRAFT', measurements: [], results: [] });

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(result.id).toBe('winning-assessment');
    });

    it('returns 409 PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT when the patient has a standalone DRAFT, never adopting it silently', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.assessment.findUnique.mockResolvedValue(null);
      mocks.tx.assessment.findFirst.mockResolvedValueOnce({ id: 'standalone-draft' });

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT');
      }
      expect(mocks.tx.assessment.create).not.toHaveBeenCalled();
    });

    it('returns 409 PATIENT_HAS_OTHER_DRAFT_ASSESSMENT when the patient has a DRAFT linked to a different encounter, never reassigning it', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.assessment.findUnique.mockResolvedValue(null);
      mocks.tx.assessment.findFirst
        .mockResolvedValueOnce(null) // sin DRAFT standalone
        .mockResolvedValueOnce({ id: 'other-encounter-draft' }); // DRAFT de otro encounter

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_OTHER_DRAFT_ASSESSMENT');
      }
      expect(mocks.tx.assessment.create).not.toHaveBeenCalled();
    });

    it('propagates 404 for cross-workspace access (delegated to EncountersService.lockEncounterForWrite)', async () => {
      mocks.encounters.lockEncounterForWrite.mockRejectedValue(new NotFoundException('Encounter not found'));
      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });

    it('rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.assessment.create).not.toHaveBeenCalled();
    });

    it('rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is COMPLETED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'COMPLETED' });
      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('returns 404 when the encounter has no Assessment yet', async () => {
      mocks.prisma.clinicalEncounter.findFirst.mockResolvedValue({ id: 'enc-1', assessment: null });
      await expect(service.findOne('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });

    it('returns 404 for cross-workspace access', async () => {
      mocks.prisma.clinicalEncounter.findFirst.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('complete', () => {
    function primeHappyPath(overrides: { engineResults?: any[] } = {}) {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'assessment-1', status: 'DRAFT' }]);
      mocks.tx.assessment.findFirstOrThrow
        .mockResolvedValueOnce({ id: 'assessment-1', date: CLINICAL_DATE, measurements: [{ definitionId: 'm_weight', numericValue: 80 }] })
        .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', measurements: [], results: [] });
      mocks.engine.calculateAll.mockReturnValue(overrides.engineResults ?? []);
      mocks.tx.assessment.updateMany.mockResolvedValue({ count: 1 });
    }

    it('completes the Assessment (DRAFT -> COMPLETED) running the clinical engine exactly once', async () => {
      primeHappyPath();
      await service.complete('user-1', 'patient-1', 'enc-1');

      expect(mocks.engine.calculateAll).toHaveBeenCalledTimes(1);
      expect(mocks.tx.assessment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'assessment-1', status: 'DRAFT' }, data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
    });

    it('reconciles EncounterModuleState.MEASUREMENTS to COMPLETED using the exact same completedAt timestamp as the Assessment', async () => {
      primeHappyPath();
      await service.complete('user-1', 'patient-1', 'enc-1');

      const assessmentCompletedAt = mocks.tx.assessment.updateMany.mock.calls[0][0].data.completedAt;
      expect(mocks.encounters.reconcileMeasurementsModule).toHaveBeenCalledWith(mocks.tx, 'enc-1', 'COMPLETED', assessmentCompletedAt);
    });

    it.each(['MISSING_DATA', 'PENDING_RULE', 'NOT_APPLICABLE'])(
      'a CalculatedResult with status %s does not block completing the module',
      async (status) => {
        primeHappyPath({ engineResults: [{ metricId: 'BMI', status, numericValue: null }] });
        await expect(service.complete('user-1', 'patient-1', 'enc-1')).resolves.toBeDefined();
        expect(mocks.tx.assessment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
        expect(mocks.encounters.reconcileMeasurementsModule).toHaveBeenCalledWith(mocks.tx, 'enc-1', 'COMPLETED', expect.any(Date));
      },
    );

    it('rejects with 400 when the Assessment has no measurements', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'assessment-1', status: 'DRAFT' }]);
      mocks.tx.assessment.findFirstOrThrow.mockResolvedValueOnce({ id: 'assessment-1', date: CLINICAL_DATE, measurements: [] });

      await expect(service.complete('user-1', 'patient-1', 'enc-1')).rejects.toThrow(BadRequestException);
      expect(mocks.tx.assessment.updateMany).not.toHaveBeenCalled();
    });

    it('rejects with 409 ASSESSMENT_NOT_DRAFT when the Assessment is not a DRAFT', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'assessment-1', status: 'COMPLETED' }]);

      try {
        await service.complete('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('ASSESSMENT_NOT_DRAFT');
      }
    });

    it('rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.complete('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('upsertMeasurements / removeMeasurement (mutation guards)', () => {
    it('upsertMeasurements rejects with ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.upsertMeasurements('user-1', 'patient-1', 'enc-1', { measurements: [] } as any)).rejects.toThrow(ConflictException);
    });

    it('upsertMeasurements rejects with ASSESSMENT_NOT_DRAFT when the linked Assessment is COMPLETED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'assessment-1', status: 'COMPLETED' }]);

      await expect(
        service.upsertMeasurements('user-1', 'patient-1', 'enc-1', { measurements: [{ definitionId: 'm_weight', numericValue: 80 }] } as any),
      ).rejects.toThrow(ConflictException);
      expect(mocks.tx.measurementRecord.upsert).not.toHaveBeenCalled();
    });

    it('removeMeasurement rejects with 409 when the encounter is COMPLETED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'COMPLETED' });
      await expect(service.removeMeasurement('user-1', 'patient-1', 'enc-1', 'm_weight')).rejects.toThrow(ConflictException);
    });
  });
});
