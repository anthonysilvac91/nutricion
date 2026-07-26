import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContextResolverService } from './context-resolver.service';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: any;
  let contextResolver: { resolveContext: jest.Mock };
  let engine: { calculateAll: jest.Mock };

  beforeEach(async () => {
    prisma = {
      patient: { findFirst: jest.fn(), findFirstOrThrow: jest.fn() },
      measurementDefinition: { findMany: jest.fn(), findUnique: jest.fn() },
      assessment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      measurementRecord: { createMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
      calculatedResult: { createMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn((arg) => {
        // Supports both call shapes used by the service: a callback (interactive
        // transaction) and an array of prisma promises (batch transaction).
        if (typeof arg === 'function') {
          return arg({
            assessment: { create: jest.fn().mockResolvedValue({ id: 'assessment-1' }), update: jest.fn() },
            measurementRecord: { createMany: jest.fn() },
            calculatedResult: { createMany: jest.fn(), deleteMany: jest.fn() },
          });
        }
        return Promise.all(arg);
      }),
    };
    contextResolver = { resolveContext: jest.fn() };
    engine = { calculateAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ContextResolverService,
          useValue: contextResolver,
        },
        {
          provide: ClinicalCalculationEngineService,
          useValue: engine,
        },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('filters patient ownership before creating an assessment', async () => {
    const patient = {
      id: 'patient-1',
      userId: 'user-1',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      sex: 'MALE',
      activityLevel: 'MODERATE',
    };
    prisma.patient.findFirst.mockResolvedValue(patient);
    prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight' }]);
    contextResolver.resolveContext.mockReturnValue({
      ageAtAssessmentMonths: 432,
      populationGroup: 'ADULT',
      specialProfile: 'STANDARD',
      clinicalProtocol: 'STANDARD',
    });
    engine.calculateAll.mockReturnValue([]);
    prisma.assessment.findFirst.mockResolvedValue({
      id: 'assessment-1',
      measurements: [],
      results: [],
    });

    await service.create('user-1', 'patient-1', {
      date: '2026-03-01T10:00:00.000Z',
      measurements: [{ definitionId: 'm_weight', numericValue: 80 }],
    });

    expect(prisma.patient.findFirst).toHaveBeenCalledWith({
      where: { id: 'patient-1', userId: 'user-1' },
    });
  });

  it('rejects a measurement with neither numericValue nor stringValue', async () => {
    prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight' }]);
    await expect(
      service.create('user-1', 'patient-1', {
        date: '2026-03-01T10:00:00.000Z',
        measurements: [{ definitionId: 'm_weight' } as any],
      }),
    ).rejects.toThrow('Each measurement requires a numericValue or stringValue');
  });

  it('filters assessment reads by patient owner', async () => {
    prisma.assessment.findFirst.mockResolvedValue({
      id: 'assessment-1',
      measurements: [],
      results: [],
    });

    await service.findOne('user-1', 'assessment-1');

    expect(prisma.assessment.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'assessment-1',
        patient: { userId: 'user-1' },
      },
      include: {
        measurements: true,
        results: true,
      },
    });
  });

  it('filters latest patient assessment reads by patient owner', async () => {
    prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
    prisma.assessment.findFirst.mockResolvedValue({
      id: 'assessment-1',
      measurements: [],
      results: [],
    });

    await service.findLatestByPatient('user-1', 'patient-1');

    expect(prisma.assessment.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: 'patient-1',
      },
      orderBy: { date: 'desc' },
      include: {
        measurements: true,
        results: true,
      },
    });
  });

  it('throws not found before latest read when patient is not owned', async () => {
    prisma.patient.findFirst.mockResolvedValue(null);

    await expect(service.findLatestByPatient('user-1', 'patient-1')).rejects.toThrow(
      'Patient not found',
    );
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
        .mockResolvedValueOnce({ id: 'draft-1', status: 'DRAFT' }) // existing check
        .mockResolvedValueOnce({ id: 'draft-1', measurements: [], results: [] }); // findOneForPatient

      const result = await service.createOrGetDraft('user-1', 'patient-1', {});

      expect(prisma.assessment.create).not.toHaveBeenCalled();
      expect(result.id).toBe('draft-1');
    });

    it('creates a new empty DRAFT when none exists, without running the calculation engine', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
      prisma.assessment.findFirst
        .mockResolvedValueOnce(null) // no existing draft
        .mockResolvedValueOnce({ id: 'new-draft', measurements: [], results: [] }); // findOneForPatient
      prisma.assessment.create.mockResolvedValue({ id: 'new-draft' });

      const result = await service.createOrGetDraft('user-1', 'patient-1', { date: '2026-07-26T00:00:00.000Z' });

      expect(prisma.assessment.create).toHaveBeenCalledWith({
        data: { patientId: 'patient-1', date: new Date('2026-07-26T00:00:00.000Z'), status: 'DRAFT' },
      });
      expect(engine.calculateAll).not.toHaveBeenCalled();
      expect(contextResolver.resolveContext).not.toHaveBeenCalled();
      expect(result.id).toBe('new-draft');
    });

    it('recovers the winning DRAFT on a P2002 concurrency race instead of failing', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
      prisma.assessment.findFirst
        .mockResolvedValueOnce(null) // no existing draft seen by this request
        .mockResolvedValueOnce({ id: 'winning-draft', measurements: [], results: [] }); // findOneForPatient after recovering
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      prisma.assessment.create.mockRejectedValue(p2002);
      prisma.assessment.findFirstOrThrow.mockResolvedValue({ id: 'winning-draft' });

      const result = await service.createOrGetDraft('user-1', 'patient-1', {});
      expect(result.id).toBe('winning-draft');
    });
  });

  describe('upsertMeasurements', () => {
    it('throws NotFoundException when the assessment does not belong to this patient/user', async () => {
      prisma.assessment.findFirst.mockResolvedValue(null);
      await expect(
        service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', { measurements: [{ definitionId: 'm_weight', numericValue: 70 }] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the assessment is not a DRAFT', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', status: 'COMPLETED' });
      await expect(
        service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', { measurements: [{ definitionId: 'm_weight', numericValue: 70 }] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate definitionId within the same payload', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT' });
      await expect(
        service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', {
          measurements: [
            { definitionId: 'm_weight', numericValue: 70 },
            { definitionId: 'm_weight', numericValue: 71 },
          ],
        }),
      ).rejects.toThrow('Duplicate measurement definitions');
    });

    it('rejects a definitionId that does not exist in the catalog', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT' });
      prisma.measurementDefinition.findMany.mockResolvedValue([]);
      await expect(
        service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', { measurements: [{ definitionId: 'does_not_exist', numericValue: 1 }] }),
      ).rejects.toThrow('do not exist');
    });

    it('upserts each measurement by assessmentId+definitionId and returns the updated assessment', async () => {
      prisma.assessment.findFirst
        .mockResolvedValueOnce({ id: 'assessment-1', status: 'DRAFT' }) // ownership check
        .mockResolvedValueOnce({ id: 'assessment-1', measurements: [{ definitionId: 'm_weight' }, { definitionId: 'm_height' }], results: [] }); // findOneForPatient
      prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight' }, { id: 'm_height' }]);
      prisma.measurementRecord.upsert.mockResolvedValue({});

      const result = await service.upsertMeasurements('user-1', 'patient-1', 'assessment-1', {
        measurements: [
          { definitionId: 'm_weight', numericValue: 70 },
          { definitionId: 'm_height', numericValue: 175 },
        ],
      });

      expect(prisma.measurementRecord.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.measurementRecord.upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { assessmentId_definitionId: { assessmentId: 'assessment-1', definitionId: 'm_weight' } },
      }));
      expect(result.measurements.length).toBe(2);
    });
  });

  describe('removeMeasurement', () => {
    it('throws BadRequestException when the assessment is COMPLETED', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', status: 'COMPLETED' });
      await expect(service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight')).rejects.toThrow(BadRequestException);
      expect(prisma.measurementRecord.deleteMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the measurement is not part of the draft', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT' });
      prisma.measurementRecord.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight')).rejects.toThrow(NotFoundException);
    });

    it('deletes the measurement and returns the updated assessment', async () => {
      prisma.assessment.findFirst
        .mockResolvedValueOnce({ id: 'assessment-1', status: 'DRAFT' })
        .mockResolvedValueOnce({ id: 'assessment-1', measurements: [], results: [] });
      prisma.measurementRecord.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeMeasurement('user-1', 'patient-1', 'assessment-1', 'm_weight');
      expect(prisma.measurementRecord.deleteMany).toHaveBeenCalledWith({ where: { assessmentId: 'assessment-1', definitionId: 'm_weight' } });
      expect(result.id).toBe('assessment-1');
    });
  });

  describe('complete', () => {
    const draftWithMeasurements = {
      id: 'assessment-1',
      patientId: 'patient-1',
      status: 'DRAFT',
      date: new Date('2026-07-26T00:00:00.000Z'),
      measurements: [
        { definitionId: 'm_weight', numericValue: 70, stringValue: null },
        { definitionId: 'm_height', numericValue: 175, stringValue: null },
      ],
    };

    it('throws NotFoundException when the assessment is not owned', async () => {
      prisma.assessment.findFirst.mockResolvedValue(null);
      await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the assessment is already COMPLETED', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ ...draftWithMeasurements, status: 'COMPLETED' });
      await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when the draft has no measurements', async () => {
      prisma.assessment.findFirst.mockResolvedValue({ ...draftWithMeasurements, measurements: [] });
      await expect(service.complete('user-1', 'patient-1', 'assessment-1')).rejects.toThrow('At least one measurement is required');
    });

    it('runs the calculation engine, replaces CalculatedResult and marks the assessment COMPLETED with completedAt', async () => {
      prisma.assessment.findFirst
        .mockResolvedValueOnce(draftWithMeasurements) // lookup for complete()
        .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', measurements: [], results: [] }); // findOneForPatient after
      prisma.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
      contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
      engine.calculateAll.mockReturnValue([
        { metricId: 'BMI', status: 'CALCULATED', numericValue: 22.8, formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' },
      ]);

      const txSpy = prisma.$transaction as jest.Mock;
      await service.complete('user-1', 'patient-1', 'assessment-1');

      expect(engine.calculateAll).toHaveBeenCalledWith(
        expect.objectContaining({ populationGroup: 'ADULT' }),
        expect.objectContaining({ id: 'patient-1' }),
        expect.arrayContaining([expect.objectContaining({ definitionId: 'm_weight', numericValue: 70 })]),
      );
      expect(txSpy).toHaveBeenCalled();
    });

    it('completes even when weight/height are missing, letting the engine report MISSING_DATA', async () => {
      prisma.assessment.findFirst
        .mockResolvedValueOnce({ ...draftWithMeasurements, measurements: [{ definitionId: 'm_waist', numericValue: 80, stringValue: null }] })
        .mockResolvedValueOnce({ id: 'assessment-1', status: 'COMPLETED', measurements: [], results: [] });
      prisma.patient.findFirstOrThrow.mockResolvedValue({ id: 'patient-1', sex: 'MALE', birthDate: new Date('1990-01-01'), activityLevel: 'MODERATE' });
      contextResolver.resolveContext.mockReturnValue({ ageAtAssessmentMonths: 432, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'STANDARD' });
      engine.calculateAll.mockReturnValue([
        { metricId: 'BMI', status: 'MISSING_DATA', formulaUsed: 'BMI_ADULT_V1', formulaVersion: 'v1.0.0', engineVersion: 'v1.0.0' },
      ]);

      await expect(service.complete('user-1', 'patient-1', 'assessment-1')).resolves.toBeDefined();
    });
  });
});
