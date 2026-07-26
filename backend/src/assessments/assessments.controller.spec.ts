import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { MeasurementSummaryService } from './measurement-summary.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AssessmentsController', () => {
  let controller: AssessmentsController;
  let service: jest.Mocked<AssessmentsService>;
  let summaryService: jest.Mocked<MeasurementSummaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [
        {
          provide: AssessmentsService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findLatestByPatient: jest.fn(),
            findAllByPatient: jest.fn(),
            createOrGetDraft: jest.fn(),
            findOneForPatient: jest.fn(),
            upsertMeasurements: jest.fn(),
            removeMeasurement: jest.fn(),
            complete: jest.fn(),
          },
        },
        {
          provide: MeasurementSummaryService,
          useValue: {
            getSummary: jest.fn(),
            getHistory: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: JwtService,
          useValue: {},
        }
      ],
    }).compile();

    controller = module.get<AssessmentsController>(AssessmentsController);
    service = module.get(AssessmentsService);
    summaryService = module.get(MeasurementSummaryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes authenticated user id when creating an assessment', async () => {
    const dto = {
      date: '2026-03-01T10:00:00.000Z',
      measurements: [{ definitionId: 'm_weight', numericValue: 80 }],
    };
    service.create.mockResolvedValue({ id: 'assessment-1' } as any);

    await controller.create({ user: { sub: 'user-1' } }, 'patient-1', dto);

    expect(service.create).toHaveBeenCalledWith('user-1', 'patient-1', dto);
  });

  it('passes authenticated user id when reading the latest patient assessment', async () => {
    service.findLatestByPatient.mockResolvedValue({ id: 'assessment-1' } as any);

    await controller.findLatest({ user: { sub: 'user-1' } }, 'patient-1');

    expect(service.findLatestByPatient).toHaveBeenCalledWith('user-1', 'patient-1');
  });

  it('passes authenticated user id when reading one assessment', async () => {
    service.findOne.mockResolvedValue({ id: 'assessment-1' } as any);

    await controller.findOne({ user: { sub: 'user-1' } }, 'assessment-1');

    expect(service.findOne).toHaveBeenCalledWith('user-1', 'assessment-1');
  });

  it('creates or recovers the active draft', async () => {
    service.createOrGetDraft.mockResolvedValue({ id: 'draft-1' } as any);
    await controller.createOrGetDraft({ user: { sub: 'user-1' } }, 'patient-1', {});
    expect(service.createOrGetDraft).toHaveBeenCalledWith('user-1', 'patient-1', {});
  });

  it('reads a single assessment scoped to the patient', async () => {
    service.findOneForPatient.mockResolvedValue({ id: 'assessment-1' } as any);
    await controller.findOneForPatient({ user: { sub: 'user-1' } }, 'patient-1', 'assessment-1');
    expect(service.findOneForPatient).toHaveBeenCalledWith('user-1', 'patient-1', 'assessment-1');
  });

  it('upserts measurements on the draft', async () => {
    const dto = { measurements: [{ definitionId: 'm_weight', numericValue: 70 }] };
    service.upsertMeasurements.mockResolvedValue({ id: 'assessment-1' } as any);
    await controller.upsertMeasurements({ user: { sub: 'user-1' } }, 'patient-1', 'assessment-1', dto as any);
    expect(service.upsertMeasurements).toHaveBeenCalledWith('user-1', 'patient-1', 'assessment-1', dto);
  });

  it('removes a measurement from the draft', async () => {
    service.removeMeasurement.mockResolvedValue({ id: 'assessment-1' } as any);
    await controller.removeMeasurement({ user: { sub: 'user-1' } }, 'patient-1', 'assessment-1', 'm_weight');
    expect(service.removeMeasurement).toHaveBeenCalledWith('user-1', 'patient-1', 'assessment-1', 'm_weight');
  });

  it('completes the draft assessment', async () => {
    service.complete.mockResolvedValue({ id: 'assessment-1', status: 'COMPLETED' } as any);
    await controller.complete({ user: { sub: 'user-1' } }, 'patient-1', 'assessment-1');
    expect(service.complete).toHaveBeenCalledWith('user-1', 'patient-1', 'assessment-1');
  });

  it('returns the measurement summary', async () => {
    summaryService.getSummary.mockResolvedValue({ patientId: 'patient-1' } as any);
    await controller.getSummary({ user: { sub: 'user-1' } }, 'patient-1');
    expect(summaryService.getSummary).toHaveBeenCalledWith('user-1', 'patient-1');
  });

  it('returns paginated measurement history with default pagination', async () => {
    summaryService.getHistory.mockResolvedValue({ data: [] } as any);
    await controller.getHistory({ user: { sub: 'user-1' } }, 'patient-1', 'm_weight', undefined, undefined);
    expect(summaryService.getHistory).toHaveBeenCalledWith('user-1', 'patient-1', 'm_weight', 1, 20);
  });
});
