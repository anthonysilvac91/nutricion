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
      patient: { findFirst: jest.fn() },
      measurementDefinition: { findMany: jest.fn() },
      assessment: { create: jest.fn(), findFirst: jest.fn() },
      measurementRecord: { createMany: jest.fn() },
      calculatedResult: { createMany: jest.fn() },
      $transaction: jest.fn((cb) =>
        cb({
          assessment: { create: jest.fn().mockResolvedValue({ id: 'assessment-1' }) },
          measurementRecord: { createMany: jest.fn() },
          calculatedResult: { createMany: jest.fn() },
        }),
      ),
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
    engine.calculateAll.mockResolvedValue([]);
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
});
