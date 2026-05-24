import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AssessmentsController', () => {
  let controller: AssessmentsController;
  let service: jest.Mocked<AssessmentsService>;

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
});
