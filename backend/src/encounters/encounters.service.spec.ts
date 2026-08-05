import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EncountersService } from './encounters.service';
import { ENCOUNTER_MODULE_ORDER } from './foundation-flow.constants';

function buildPrismaMock() {
  const tx = {
    $queryRaw: jest.fn(),
    clinicalEncounter: { create: jest.fn(), updateMany: jest.fn() },
    encounterModuleState: { createMany: jest.fn() },
  };
  const prisma = {
    patient: { findUnique: jest.fn() },
    workspaceMember: { findUnique: jest.fn() },
    clinicalEncounter: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    // Soporta ambas formas de $transaction: callback (create/discard) y array (findAllByPatient).
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  return { prisma, tx };
}

const VALID_DTO = {
  profile: 'ADULT_GENERAL' as const,
  type: 'FIRST_VISIT' as const,
  clinicalDate: '2026-08-04',
  consultationReason: 'Control nutricional',
};

function fullDetailFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'enc-1',
    patientId: 'patient-1',
    workspaceId: 'ws-1',
    responsibleProfessionalId: 'user-1',
    profile: 'ADULT_GENERAL',
    type: 'FIRST_VISIT',
    status: 'IN_PROGRESS',
    flowVersion: 'foundation-v1',
    clinicalDate: new Date('2026-08-04T12:00:00.000Z'),
    startedAt: new Date('2026-08-04T12:00:00.000Z'),
    completedAt: null,
    discardedAt: null,
    consultationReason: 'Control nutricional',
    discardReason: null,
    notes: null,
    modules: [],
    ...overrides,
  };
}

describe('EncountersService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>['prisma'];
  let tx: ReturnType<typeof buildPrismaMock>['tx'];
  let service: EncountersService;

  beforeEach(() => {
    const mocks = buildPrismaMock();
    prisma = mocks.prisma;
    tx = mocks.tx;
    service = new EncountersService(prisma as any);
  });

  it('does not expose complete/reopen/updateStatus/update -- no transition to COMPLETED and no generic status update exist in this cut', () => {
    expect((service as any).complete).toBeUndefined();
    expect((service as any).reopen).toBeUndefined();
    expect((service as any).updateStatus).toBeUndefined();
    expect((service as any).update).toBeUndefined();
  });

  describe('create', () => {
    it('assigns the patient workspace and the authenticated user as responsible, creating exactly 9 modules in the same transaction', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'ws-1' });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
      prisma.clinicalEncounter.findFirst
        .mockResolvedValueOnce(null) // pre-chequeo: sin IN_PROGRESS existente
        .mockResolvedValueOnce(fullDetailFixture()); // findOneForPatient posterior al create
      tx.clinicalEncounter.create.mockResolvedValue({ id: 'enc-1' });
      tx.encounterModuleState.createMany.mockResolvedValue({ count: 9 });

      const result = await service.create('user-1', 'patient-1', VALID_DTO as any);

      expect(tx.clinicalEncounter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          patientId: 'patient-1',
          responsibleProfessionalId: 'user-1',
          status: 'IN_PROGRESS',
          flowVersion: 'foundation-v1',
        }),
      });
      const moduleCall = tx.encounterModuleState.createMany.mock.calls[0][0];
      expect(moduleCall.data).toHaveLength(9);
      expect(new Set(moduleCall.data.map((m: any) => m.module)).size).toBe(9);
      expect(result.id).toBe('enc-1');
    });

    it('rejects a patient with workspaceId null with a controlled PATIENT_WORKSPACE_NOT_READY error, not a 500', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: null });

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(ConflictException);
      try {
        await service.create('user-1', 'patient-1', VALID_DTO as any);
        fail('expected to throw');
      } catch (e: any) {
        expect(e.getResponse().code).toBe('PATIENT_WORKSPACE_NOT_READY');
      }
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns 404 when the patient does not exist', async () => {
      prisma.patient.findUnique.mockResolvedValue(null);
      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(NotFoundException);
    });

    it('returns 404 (not 403) when the authenticated user is not a member of the patient workspace', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'other-ws' });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(NotFoundException);
    });

    it('returns 409 ENCOUNTER_ALREADY_IN_PROGRESS when the pre-check finds an existing open encounter', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'ws-1' });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
      prisma.clinicalEncounter.findFirst.mockResolvedValueOnce({ id: 'existing-enc' });

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('maps a P2002 raised by the DB partial unique index (race window) to 409 ENCOUNTER_ALREADY_IN_PROGRESS', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'ws-1' });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
      prisma.clinicalEncounter.findFirst.mockResolvedValueOnce(null); // el pre-chequeo no ve nada todavía
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      tx.clinicalEncounter.create.mockRejectedValue(p2002);

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByPatient', () => {
    it('checks workspace access before listing and orders deterministically by clinicalDate desc, startedAt desc, id desc', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'ws-1' });
      prisma.workspaceMember.findUnique.mockResolvedValue({ id: 'member-1' });
      prisma.clinicalEncounter.findMany.mockResolvedValue([fullDetailFixture()]);
      prisma.clinicalEncounter.count.mockResolvedValue(1);

      await service.findAllByPatient('user-1', 'patient-1', { page: 1, pageSize: 10 } as any);

      expect(prisma.clinicalEncounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ clinicalDate: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('returns 404 for a patient in another workspace', async () => {
      prisma.patient.findUnique.mockResolvedValue({ id: 'patient-1', workspaceId: 'other-ws' });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.findAllByPatient('user-1', 'patient-1', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOneForPatient', () => {
    it('returns 404 when the encounter does not belong to the caller workspace', async () => {
      prisma.clinicalEncounter.findFirst.mockResolvedValue(null);
      await expect(service.findOneForPatient('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });

    it('orders modules by ENCOUNTER_MODULE_ORDER regardless of the order returned by the DB', async () => {
      const shuffled = [
        { module: 'FOLLOW_UP', applicability: 'OPTIONAL', status: 'PENDING', completedAt: null },
        { module: 'SUMMARY', applicability: 'NOT_APPLICABLE', status: 'NOT_APPLICABLE', completedAt: null },
        { module: 'MEASUREMENTS', applicability: 'REQUIRED', status: 'PENDING', completedAt: null },
      ];
      prisma.clinicalEncounter.findFirst.mockResolvedValue(fullDetailFixture({ modules: shuffled }));

      const detail = await service.findOneForPatient('user-1', 'patient-1', 'enc-1');

      const expectedOrder = ENCOUNTER_MODULE_ORDER.filter((m) => shuffled.some((s) => s.module === m));
      expect(detail.modules.map((m: any) => m.module)).toEqual(expectedOrder);
    });

    it('progress excludes NOT_APPLICABLE modules and counts only COMPLETED ones', async () => {
      const modules = [
        { module: 'SUMMARY', applicability: 'NOT_APPLICABLE', status: 'NOT_APPLICABLE', completedAt: null },
        { module: 'ANAMNESIS', applicability: 'REQUIRED', status: 'COMPLETED', completedAt: new Date() },
        { module: 'MEASUREMENTS', applicability: 'REQUIRED', status: 'PENDING', completedAt: null },
        { module: 'PLANNING', applicability: 'NOT_APPLICABLE', status: 'NOT_APPLICABLE', completedAt: null },
        { module: 'MEAL_PLAN', applicability: 'OPTIONAL', status: 'PENDING', completedAt: null },
      ];
      prisma.clinicalEncounter.findFirst.mockResolvedValue(fullDetailFixture({ modules }));

      const detail = await service.findOneForPatient('user-1', 'patient-1', 'enc-1');

      // 2 NOT_APPLICABLE excluidos -> total = 3 (ANAMNESIS, MEASUREMENTS, MEAL_PLAN); completed = 1 (ANAMNESIS)
      expect(detail.progress).toEqual({ completed: 1, total: 3 });
    });
  });

  describe('discard', () => {
    it('discards a valid IN_PROGRESS encounter, sets discardedAt, and never touches consultationReason', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'IN_PROGRESS' }]);
      tx.clinicalEncounter.updateMany.mockResolvedValue({ count: 1 });
      prisma.clinicalEncounter.findFirst.mockResolvedValue(
        fullDetailFixture({ status: 'DISCARDED', discardedAt: new Date(), discardReason: 'No show' }),
      );

      const result = await service.discard('user-1', 'patient-1', 'enc-1', { discardReason: 'No show' } as any);

      expect(tx.clinicalEncounter.updateMany).toHaveBeenCalledWith({
        where: { id: 'enc-1', status: 'IN_PROGRESS' },
        data: { status: 'DISCARDED', discardedAt: expect.any(Date), discardReason: 'No show' },
      });
      // La llamada a updateMany no incluye la clave consultationReason en absoluto.
      expect(Object.keys(tx.clinicalEncounter.updateMany.mock.calls[0][0].data)).not.toContain('consultationReason');
      expect(result.status).toBe('DISCARDED');
      expect(result.consultationReason).toBe('Control nutricional');
    });

    it('a second discard on an already-DISCARDED encounter returns 409 ENCOUNTER_NOT_IN_PROGRESS', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'DISCARDED' }]);

      await expect(service.discard('user-1', 'patient-1', 'enc-1', { discardReason: 'No show' } as any)).rejects.toThrow(ConflictException);
      expect(tx.clinicalEncounter.updateMany).not.toHaveBeenCalled();
    });

    it('returns 404 when the encounter is not visible from the caller workspace (lock query finds nothing)', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      await expect(service.discard('user-1', 'patient-1', 'enc-1', { discardReason: 'No show' } as any)).rejects.toThrow(NotFoundException);
    });
  });
});
