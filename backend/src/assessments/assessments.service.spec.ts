import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContextResolverService } from './context-resolver.service';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';

describe('AssessmentsService', () => {
  let service: AssessmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        {
          provide: PrismaService,
          useValue: {
            patient: { findUnique: jest.fn() },
            assessment: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
            measurementRecord: { createMany: jest.fn() },
            calculatedResult: { createMany: jest.fn() },
            $transaction: jest.fn((cb) => cb({
              assessment: { create: jest.fn().mockResolvedValue({ id: '1' }) },
              measurementRecord: { createMany: jest.fn() },
              calculatedResult: { createMany: jest.fn() },
            })),
          },
        },
        {
          provide: ContextResolverService,
          useValue: { resolveContext: jest.fn() },
        },
        {
          provide: ClinicalCalculationEngineService,
          useValue: { calculateAll: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AssessmentsService>(AssessmentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
