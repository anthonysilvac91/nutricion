import { Test, TestingModule } from '@nestjs/testing';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: PrismaService,
          useValue: {
            patient: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              updateMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            assessment: { findFirst: jest.fn() },
            $transaction: jest.fn((cb) => cb([[], 0])),
          },
        },
        {
          provide: CalculationStrategyRegistry,
          useValue: { listCatalog: jest.fn().mockReturnValue([]) },
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
