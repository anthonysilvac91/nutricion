import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PatientsService } from './patients.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';

function buildPrismaMock() {
  return {
    patient: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    assessment: { findFirst: jest.fn() },
    clinicalEncounter: { count: jest.fn() },
    $transaction: jest.fn((cb) => cb([[], 0])),
  };
}

describe('PatientsService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: PatientsService;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: PrismaService, useValue: prisma },
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

  describe('remove', () => {
    const p2003 = new Prisma.PrismaClientKnownRequestError('foreign key violation', { code: 'P2003', clientVersion: 'x' });

    it('maps the P2003 to PATIENT_HAS_CLINICAL_ENCOUNTERS only when the patient actually has a ClinicalEncounter', async () => {
      prisma.patient.deleteMany.mockRejectedValue(p2003);
      prisma.clinicalEncounter.count.mockResolvedValue(1);

      await expect(service.remove('user-1', 'patient-1')).rejects.toThrow(ConflictException);
      try {
        await service.remove('user-1', 'patient-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e.getResponse().code).toBe('PATIENT_HAS_CLINICAL_ENCOUNTERS');
      }
      expect(prisma.clinicalEncounter.count).toHaveBeenCalledWith({ where: { patientId: 'patient-1' } });
    });

    it('does NOT label a P2003 caused by another relation (e.g. Assessment/NutritionalPlan) as PATIENT_HAS_CLINICAL_ENCOUNTERS -- it re-throws the original error', async () => {
      prisma.patient.deleteMany.mockRejectedValue(p2003);
      prisma.clinicalEncounter.count.mockResolvedValue(0); // el paciente no tiene ningún Encounter

      await expect(service.remove('user-1', 'patient-1')).rejects.toBe(p2003);
    });
  });
});
