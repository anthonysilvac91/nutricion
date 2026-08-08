import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EncountersService } from './encounters.service';
import { ENCOUNTER_MODULE_ORDER } from './foundation-flow.constants';

function buildPrismaMock() {
  const tx = {
    $queryRaw: jest.fn(),
    clinicalEncounter: { create: jest.fn(), updateMany: jest.fn() },
    encounterModuleState: { createMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    assessment: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    nutritionalPlan: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    patient: { findFirst: jest.fn() },
    clinicalEncounter: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    // Usado por findAccessibleEncounterForRead (lectura sin lock, fuera de una transacción).
    $queryRaw: jest.fn(),
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

// Fila devuelta por findAccessibleEncounterForRead (prisma.$queryRaw) -- la
// autorización que findOneForPatient ahora exige antes de leer el detalle.
const ACCESS_ROW = [{ id: 'enc-1', status: 'IN_PROGRESS', clinicalDate: new Date('2026-08-04T12:00:00.000Z') }];

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
      prisma.patient.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
      prisma.clinicalEncounter.findFirst.mockResolvedValueOnce(null); // pre-chequeo: sin IN_PROGRESS existente
      prisma.$queryRaw.mockResolvedValueOnce(ACCESS_ROW); // findAccessibleEncounterForRead dentro de findOneForPatient posterior al create
      prisma.clinicalEncounter.findUnique.mockResolvedValueOnce(fullDetailFixture());
      tx.clinicalEncounter.create.mockResolvedValue({ id: 'enc-1' });
      tx.encounterModuleState.createMany.mockResolvedValue({ count: 9 });

      const result = await service.create('user-1', 'patient-1', VALID_DTO as any);

      expect(prisma.patient.findFirst).toHaveBeenCalledWith({
        where: { id: 'patient-1', workspace: { members: { some: { userId: 'user-1' } } } },
        select: { workspaceId: true },
      });
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

    // Las 4 causas de acceso denegado son indistinguibles a propósito: todas
    // producen el mismo `patient.findFirst` -> null -> el mismo 404, nunca un
    // código que revele CUÁL de las 4 ocurrió (ver PATIENT_WORKSPACE_NOT_READY,
    // removido explícitamente por ese motivo).
    it('returns 404 (not a distinguishable error) when the patient does not exist', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns 404 (not a distinguishable error) when the patient has workspaceId null', async () => {
      // El propio filtro `workspace: { members: { some: ... } } }` no puede
      // matchear una relación nula, así que Prisma real también devolvería
      // null aquí -- se simula explícitamente para dejar el caso documentado.
      prisma.patient.findFirst.mockResolvedValue(null);
      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(NotFoundException);
    });

    it('returns 404 (not 403) when the authenticated user is not a member of the patient workspace', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(NotFoundException);
    });

    it('returns 409 ENCOUNTER_ALREADY_IN_PROGRESS when the pre-check finds an existing open encounter', async () => {
      prisma.patient.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
      prisma.clinicalEncounter.findFirst.mockResolvedValueOnce({ id: 'existing-enc' });

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(ConflictException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('maps a P2002 raised by the DB partial unique index (race window) to 409 ENCOUNTER_ALREADY_IN_PROGRESS', async () => {
      prisma.patient.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
      prisma.clinicalEncounter.findFirst.mockResolvedValueOnce(null); // el pre-chequeo no ve nada todavía
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      tx.clinicalEncounter.create.mockRejectedValue(p2002);

      await expect(service.create('user-1', 'patient-1', VALID_DTO as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllByPatient', () => {
    it('checks workspace access before listing, orders deterministically, and repeats the WorkspaceMember filter in the where clause as defense in depth', async () => {
      prisma.patient.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
      prisma.clinicalEncounter.findMany.mockResolvedValue([fullDetailFixture()]);
      prisma.clinicalEncounter.count.mockResolvedValue(1);

      await service.findAllByPatient('user-1', 'patient-1', { page: 1, pageSize: 10 } as any);

      expect(prisma.clinicalEncounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            patientId: 'patient-1',
            workspaceId: 'ws-1',
            workspace: { members: { some: { userId: 'user-1' } } },
          }),
          orderBy: [{ clinicalDate: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('returns 404 for a patient in another workspace', async () => {
      prisma.patient.findFirst.mockResolvedValue(null);
      await expect(service.findAllByPatient('user-1', 'patient-1', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('excludes a structurally inconsistent ClinicalEncounter (its own workspaceId != the Patient real workspaceId) even if the caller happens to be a member of that other workspace', async () => {
      prisma.patient.findFirst.mockResolvedValue({ workspaceId: 'ws-1' });
      prisma.clinicalEncounter.findMany.mockResolvedValue([]);
      prisma.clinicalEncounter.count.mockResolvedValue(0);

      await service.findAllByPatient('user-1', 'patient-1', { page: 1, pageSize: 10 } as any);

      // El where real exige workspaceId = 'ws-1' (el del Patient) -- un
      // Encounter con workspaceId distinto (p.ej. 'ws-2') nunca matchea, sin
      // importar si el caller también es miembro de 'ws-2'.
      expect(prisma.clinicalEncounter.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1' }) }),
      );
    });
  });

  describe('findOneForPatient', () => {
    it('returns 404 when the encounter does not belong to the caller workspace (findAccessibleEncounterForRead finds nothing)', async () => {
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.findOneForPatient('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
      expect(prisma.clinicalEncounter.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 for a structurally inconsistent Encounter (Patient.workspaceId != Encounter.workspaceId), reusing the exact same authorization as findAccessibleEncounterForRead -- never a second definition', async () => {
      // findAccessibleEncounterForRead ya exige p."workspaceId" = e."workspaceId"
      // -- si divergen, el JOIN no matchea nada, sin importar si el detalle en
      // sí sería consultable directamente por id.
      prisma.$queryRaw.mockResolvedValue([]);
      await expect(service.findOneForPatient('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
      expect(prisma.clinicalEncounter.findUnique).not.toHaveBeenCalled();
    });

    it('orders modules by ENCOUNTER_MODULE_ORDER regardless of the order returned by the DB', async () => {
      const shuffled = [
        { module: 'FOLLOW_UP', applicability: 'OPTIONAL', status: 'PENDING', completedAt: null },
        { module: 'SUMMARY', applicability: 'NOT_APPLICABLE', status: 'NOT_APPLICABLE', completedAt: null },
        { module: 'MEASUREMENTS', applicability: 'REQUIRED', status: 'PENDING', completedAt: null },
      ];
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValue(fullDetailFixture({ modules: shuffled }));

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
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValue(fullDetailFixture({ modules }));

      const detail = await service.findOneForPatient('user-1', 'patient-1', 'enc-1');

      // 2 NOT_APPLICABLE excluidos -> total = 3 (ANAMNESIS, MEASUREMENTS, MEAL_PLAN); completed = 1 (ANAMNESIS)
      expect(detail.progress).toEqual({ completed: 1, total: 3 });
    });
  });

  describe('discard', () => {
    it('discards a valid IN_PROGRESS encounter, sets discardedAt, and never touches consultationReason', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'IN_PROGRESS' }]);
      tx.clinicalEncounter.updateMany.mockResolvedValue({ count: 1 });
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValue(
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

    it('archives a DRAFT Assessment linked to the encounter being discarded, without touching MeasurementRecord', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'IN_PROGRESS' }]);
      tx.clinicalEncounter.updateMany.mockResolvedValue({ count: 1 });
      tx.assessment.updateMany.mockResolvedValue({ count: 1 });
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValue(fullDetailFixture({ status: 'DISCARDED' }));

      await service.discard('user-1', 'patient-1', 'enc-1', { discardReason: 'No show' } as any);

      expect(tx.assessment.updateMany).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1', status: 'DRAFT' },
        data: { status: 'ARCHIVED' },
      });
    });

    it('archives a DRAFT NutritionalPlan linked to the encounter being discarded, preserving snapshot/results/config (corte 4)', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'IN_PROGRESS' }]);
      tx.clinicalEncounter.updateMany.mockResolvedValue({ count: 1 });
      tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 1 });
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValue(fullDetailFixture({ status: 'DISCARDED' }));

      await service.discard('user-1', 'patient-1', 'enc-1', { discardReason: 'No show' } as any);

      // El updateMany solo toca status -- nunca sourceSnapshot, calculationResults,
      // calculationMetadata, config, calculatedAt ni assessmentId/encounterId.
      expect(tx.nutritionalPlan.updateMany).toHaveBeenCalledWith({
        where: { encounterId: 'enc-1', status: 'DRAFT' },
        data: { status: 'ARCHIVED' },
      });
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

  describe('findOneForPatient (assessmentId exposure)', () => {
    it('exposes assessmentId from the associated Assessment, or null when there is none', async () => {
      prisma.$queryRaw.mockResolvedValue(ACCESS_ROW);
      prisma.clinicalEncounter.findUnique.mockResolvedValueOnce(fullDetailFixture({ assessment: { id: 'assessment-1' } }));
      const withAssessment = await service.findOneForPatient('user-1', 'patient-1', 'enc-1');
      expect(withAssessment.assessmentId).toBe('assessment-1');

      prisma.clinicalEncounter.findUnique.mockResolvedValueOnce(fullDetailFixture({ assessment: null }));
      const withoutAssessment = await service.findOneForPatient('user-1', 'patient-1', 'enc-1');
      expect(withoutAssessment.assessmentId).toBeNull();
    });
  });

  describe('reconcileMeasurementsModule', () => {
    it('updates MEASUREMENTS status/completedAt when applicability is not NOT_APPLICABLE', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'REQUIRED' });
      const completedAt = new Date();

      await service.reconcileMeasurementsModule(tx as any, 'enc-1', 'COMPLETED', completedAt);

      expect(tx.encounterModuleState.update).toHaveBeenCalledWith({
        where: { encounterId_module: { encounterId: 'enc-1', module: 'MEASUREMENTS' } },
        data: { status: 'COMPLETED', completedAt },
      });
    });

    it('is a silent no-op when MEASUREMENTS applicability is NOT_APPLICABLE (never forces an incoherent state)', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'NOT_APPLICABLE' });

      await service.reconcileMeasurementsModule(tx as any, 'enc-1', 'COMPLETED', new Date());

      expect(tx.encounterModuleState.update).not.toHaveBeenCalled();
    });

    it('throws (never a silent no-op) when the MEASUREMENTS EncounterModuleState row is missing -- a valid foundation-v1 encounter always has one', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue(null);

      await expect(service.reconcileMeasurementsModule(tx as any, 'enc-1', 'COMPLETED', new Date())).rejects.toMatchObject({
        response: { code: 'ENCOUNTER_MODULE_STATE_MISSING' },
      });
      expect(tx.encounterModuleState.update).not.toHaveBeenCalled();
    });
  });

  describe('reconcilePlanningModule (corte 4)', () => {
    it('updates PLANNING status/completedAt when applicability is not NOT_APPLICABLE', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'REQUIRED' });
      const completedAt = new Date();

      await service.reconcilePlanningModule(tx as any, 'enc-1', 'COMPLETED', completedAt);

      expect(tx.encounterModuleState.findUnique).toHaveBeenCalledWith({
        where: { encounterId_module: { encounterId: 'enc-1', module: 'PLANNING' } },
      });
      expect(tx.encounterModuleState.update).toHaveBeenCalledWith({
        where: { encounterId_module: { encounterId: 'enc-1', module: 'PLANNING' } },
        data: { status: 'COMPLETED', completedAt },
      });
    });

    it('is a silent no-op when PLANNING applicability is NOT_APPLICABLE (pediatric profile)', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'NOT_APPLICABLE' });

      await service.reconcilePlanningModule(tx as any, 'enc-1', 'IN_PROGRESS', null);

      expect(tx.encounterModuleState.update).not.toHaveBeenCalled();
    });

    it('throws ENCOUNTER_MODULE_STATE_MISSING (never a silent no-op) when the PLANNING row is missing', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue(null);

      await expect(service.reconcilePlanningModule(tx as any, 'enc-1', 'IN_PROGRESS', null)).rejects.toMatchObject({
        response: { code: 'ENCOUNTER_MODULE_STATE_MISSING' },
      });
      expect(tx.encounterModuleState.update).not.toHaveBeenCalled();
    });
  });

  describe('requireModuleApplicable (corte 4)', () => {
    it('resolves without throwing when the module is REQUIRED or OPTIONAL', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'REQUIRED' });
      await expect(service.requireModuleApplicable(tx as any, 'enc-1', 'PLANNING' as any)).resolves.toBeUndefined();
    });

    it('throws 409 ENCOUNTER_MODULE_NOT_APPLICABLE when the module is NOT_APPLICABLE for this profile', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue({ applicability: 'NOT_APPLICABLE' });
      await expect(service.requireModuleApplicable(tx as any, 'enc-1', 'PLANNING' as any)).rejects.toMatchObject({
        response: { code: 'ENCOUNTER_MODULE_NOT_APPLICABLE' },
      });
    });

    it('throws 409 ENCOUNTER_MODULE_STATE_MISSING when the module row does not exist', async () => {
      tx.encounterModuleState.findUnique.mockResolvedValue(null);
      await expect(service.requireModuleApplicable(tx as any, 'enc-1', 'PLANNING' as any)).rejects.toMatchObject({
        response: { code: 'ENCOUNTER_MODULE_STATE_MISSING' },
      });
    });
  });

  describe('findAccessibleEncounterForRead', () => {
    it('returns the encounter row when the join (Encounter/Patient/WorkspaceMember) resolves', async () => {
      prisma.$queryRaw.mockResolvedValue([{ id: 'enc-1', status: 'IN_PROGRESS', clinicalDate: new Date('2026-08-04T12:00:00.000Z') }]);

      const result = await service.findAccessibleEncounterForRead('user-1', 'patient-1', 'enc-1');

      expect(result.id).toBe('enc-1');
    });

    it('returns 404 when the join resolves nothing -- covers cross-workspace access AND a structurally inconsistent row (Patient.workspaceId != Encounter.workspaceId)', async () => {
      // El JOIN exige p."workspaceId" = e."workspaceId" -- un registro con esos
      // valores distintos nunca matchea, exactamente igual que un acceso
      // cross-workspace legítimo: ambos casos son indistinguibles desde afuera.
      prisma.$queryRaw.mockResolvedValue([]);

      await expect(service.findAccessibleEncounterForRead('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });
  });
});
