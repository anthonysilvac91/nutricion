import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EncounterModule, Prisma } from '@prisma/client';
import { EncounterPlanService } from './encounter-plan.service';

function buildMocks() {
  const tx = {
    $queryRaw: jest.fn(),
    nutritionalPlan: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    assessment: { findUnique: jest.fn() },
    patient: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'patient-1', activityLevel: 'MODERATE' }) },
  };
  const prisma = {
    nutritionalPlan: { findFirst: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((arg: any) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg))),
  };
  const encounters = {
    lockEncounterForWrite: jest.fn(),
    findAccessibleEncounterForRead: jest.fn(),
    requireModuleApplicable: jest.fn(),
    reconcilePlanningModule: jest.fn(),
  };
  const plans = {
    mapToDto: jest.fn((p: any) => ({ mapped: true, ...p })),
    loadCompletedAssessment: jest.fn(),
    buildSnapshotV2: jest.fn(),
    defaultPlanInputs: jest.fn(),
    ensureSnapshotV2: jest.fn(),
  };
  const planCalculation = {
    calculate: jest.fn().mockReturnValue({}),
    buildCalculationMetadata: jest.fn().mockReturnValue({}),
    evaluateFinalizationReadiness: jest.fn().mockReturnValue({ canFinalize: true, finalizationBlockers: [] }),
  };
  return { prisma, tx, encounters, plans, planCalculation };
}

const CLINICAL_DATE = new Date('2026-08-04T12:00:00.000Z');
const IN_PROGRESS_ENCOUNTER = { id: 'enc-1', status: 'IN_PROGRESS', clinicalDate: CLINICAL_DATE };
const COMPLETED_ASSESSMENT_ROW = { id: 'assessment-1', status: 'COMPLETED' };
const FULL_ASSESSMENT = { id: 'assessment-1', populationGroup: 'ADULT' };
const SNAPSHOT = { snapshotVersion: 'v2', assessmentId: 'assessment-1' };
const CONFIG = { bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1' };

describe('EncounterPlanService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: EncounterPlanService;

  beforeEach(() => {
    mocks = buildMocks();
    service = new EncounterPlanService(mocks.prisma as any, mocks.encounters as any, mocks.plans as any, mocks.planCalculation as any);
  });

  function primeCreateHappyPath() {
    mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
    mocks.tx.nutritionalPlan.findUnique.mockResolvedValue(null); // sin plan para este encounter
    mocks.tx.assessment.findUnique.mockResolvedValue(COMPLETED_ASSESSMENT_ROW);
    mocks.tx.nutritionalPlan.findFirst.mockResolvedValue(null); // sin DRAFT standalone ni de otro encounter
    mocks.plans.loadCompletedAssessment.mockResolvedValue(FULL_ASSESSMENT);
    mocks.plans.buildSnapshotV2.mockReturnValue(SNAPSHOT);
    mocks.plans.defaultPlanInputs.mockReturnValue(CONFIG);
    mocks.tx.nutritionalPlan.create.mockResolvedValue({ id: 'plan-1' });
    mocks.tx.nutritionalPlan.findUniqueOrThrow.mockResolvedValue({ id: 'plan-1', status: 'DRAFT' });
  }

  describe('createOrGet', () => {
    it('1) creates a DRAFT plan when the encounter has none and its Assessment is COMPLETED', async () => {
      primeCreateHappyPath();

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.encounters.requireModuleApplicable).toHaveBeenCalledWith(mocks.tx, 'enc-1', EncounterModule.PLANNING);
      expect(mocks.tx.nutritionalPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'DRAFT', patientId: 'patient-1', encounterId: 'enc-1' }) }),
      );
      expect(result.id).toBe('plan-1');
    });

    it('2) uses EXACTLY encounter.assessment as the plan assessmentId -- never a different/latest Assessment', async () => {
      primeCreateHappyPath();
      await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.plans.loadCompletedAssessment).toHaveBeenCalledWith(mocks.tx, 'patient-1', 'assessment-1');
      expect(mocks.tx.nutritionalPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assessmentId: 'assessment-1' }) }),
      );
    });

    it("3) the create route takes no body -- there is no assessmentId parameter for a client to override", () => {
      // createOrGet(userId, patientId, encounterId) -- 3 parámetros, ninguno es
      // un assessmentId del cliente. El controller tampoco declara @Body() en
      // esta ruta (ver encounter-plan.controller.ts). El Assessment fuente
      // sale exclusivamente de `encounter.assessment` (ver test #2).
      expect(service.createOrGet.length).toBe(3);
    });

    it('4) create/get is idempotent: calling it again for the same encounter returns the same plan without creating a new one', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.nutritionalPlan.findUnique.mockResolvedValue({ id: 'plan-1', status: 'DRAFT' });

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
      expect(result.id).toBe('plan-1');
    });

    it('5) reconciles PLANNING to IN_PROGRESS with completedAt null when the DRAFT is created', async () => {
      primeCreateHappyPath();
      await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.encounters.reconcilePlanningModule).toHaveBeenCalledWith(mocks.tx, 'enc-1', 'IN_PROGRESS', null);
    });

    it('15) returns 409 PATIENT_HAS_UNLINKED_DRAFT_PLAN when the patient has a standalone DRAFT, never adopting it silently', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.nutritionalPlan.findUnique.mockResolvedValue(null);
      mocks.tx.assessment.findUnique.mockResolvedValue(COMPLETED_ASSESSMENT_ROW);
      mocks.tx.nutritionalPlan.findFirst.mockResolvedValueOnce({ id: 'standalone-draft' });

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_UNLINKED_DRAFT_PLAN');
      }
      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
    });

    it('16) returns 409 PATIENT_HAS_OTHER_DRAFT_PLAN when the patient has a DRAFT linked to a different encounter, never reassigning it', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.nutritionalPlan.findUnique.mockResolvedValue(null);
      mocks.tx.assessment.findUnique.mockResolvedValue(COMPLETED_ASSESSMENT_ROW);
      mocks.tx.nutritionalPlan.findFirst
        .mockResolvedValueOnce(null) // sin DRAFT standalone
        .mockResolvedValueOnce({ id: 'other-encounter-draft' }); // DRAFT de otro encounter

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_OTHER_DRAFT_PLAN');
      }
      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
    });

    it('17) Pediatric (PLANNING NOT_APPLICABLE): rejects creation with the error propagated by EncountersService.requireModuleApplicable, never depending solely on Assessment.populationGroup', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.encounters.requireModuleApplicable.mockRejectedValue(
        new ConflictException({ code: 'ENCOUNTER_MODULE_NOT_APPLICABLE', message: 'x' }),
      );

      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.nutritionalPlan.findUnique).not.toHaveBeenCalled();
      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
    });

    it('18) propagates 404 for cross-workspace access (delegated to EncountersService.lockEncounterForWrite)', async () => {
      mocks.encounters.lockEncounterForWrite.mockRejectedValue(new NotFoundException('Encounter not found'));
      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });

    it('19) rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED -- no mutation is attempted', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.encounters.requireModuleApplicable).not.toHaveBeenCalled();
      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
    });

    it('20) rejects with ENCOUNTER_MODULE_STATE_MISSING when the PLANNING module row is missing -- the whole creation aborts, nothing is partially created', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.encounters.requireModuleApplicable.mockRejectedValue(
        new ConflictException({ code: 'ENCOUNTER_MODULE_STATE_MISSING', message: 'x' }),
      );

      await expect(service.createOrGet('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.nutritionalPlan.create).not.toHaveBeenCalled();
    });

    it('24) never touches REQUIREMENTS -- only PLANNING is checked/reconciled by this service', async () => {
      primeCreateHappyPath();
      await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.encounters.requireModuleApplicable).toHaveBeenCalledWith(expect.anything(), expect.anything(), EncounterModule.PLANNING);
      expect(mocks.encounters.requireModuleApplicable).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), EncounterModule.REQUIREMENTS);
      expect(mocks.encounters.reconcilePlanningModule).toHaveBeenCalledTimes(1);
    });

    describe('Assessment preconditions (section 9)', () => {
      it('returns 409 ENCOUNTER_ASSESSMENT_REQUIRED when the encounter has no Assessment at all', async () => {
        mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
        mocks.tx.nutritionalPlan.findUnique.mockResolvedValue(null);
        mocks.tx.assessment.findUnique.mockResolvedValue(null);

        try {
          await service.createOrGet('user-1', 'patient-1', 'enc-1');
          fail('expected to throw');
        } catch (e: any) {
          expect(e).toBeInstanceOf(ConflictException);
          expect(e.getResponse().code).toBe('ENCOUNTER_ASSESSMENT_REQUIRED');
        }
      });

      it('returns 409 ENCOUNTER_ASSESSMENT_NOT_COMPLETED when the Assessment is still DRAFT', async () => {
        mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
        mocks.tx.nutritionalPlan.findUnique.mockResolvedValue(null);
        mocks.tx.assessment.findUnique.mockResolvedValue({ id: 'assessment-1', status: 'DRAFT' });

        try {
          await service.createOrGet('user-1', 'patient-1', 'enc-1');
          fail('expected to throw');
        } catch (e: any) {
          expect(e).toBeInstanceOf(ConflictException);
          expect(e.getResponse().code).toBe('ENCOUNTER_ASSESSMENT_NOT_COMPLETED');
        }
        expect(mocks.plans.loadCompletedAssessment).not.toHaveBeenCalled();
      });
    });

    it('P2002 race lost against the LEGACY standalone route: winner has encounterId === null -> 409 PATIENT_HAS_UNLINKED_DRAFT_PLAN', async () => {
      primeCreateHappyPath();
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      mocks.tx.nutritionalPlan.create.mockRejectedValue(p2002);
      mocks.prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'legacy-draft', encounterId: null, status: 'DRAFT' });

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_UNLINKED_DRAFT_PLAN');
      }
    });

    it('P2002 race lost against ANOTHER encounter: winner has a different encounterId -> 409 PATIENT_HAS_OTHER_DRAFT_PLAN', async () => {
      primeCreateHappyPath();
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      mocks.tx.nutritionalPlan.create.mockRejectedValue(p2002);
      mocks.prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'other-encounter-draft', encounterId: 'enc-2', status: 'DRAFT' });

      try {
        await service.createOrGet('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(ConflictException);
        expect(e.getResponse().code).toBe('PATIENT_HAS_OTHER_DRAFT_PLAN');
      }
    });

    it('two concurrent creates for the SAME encounter resolve to a single Plan via the P2002 race path, resolved OUTSIDE the aborted transaction', async () => {
      primeCreateHappyPath();
      const p2002 = new Prisma.PrismaClientKnownRequestError('unique violation', { code: 'P2002', clientVersion: 'x' });
      mocks.tx.nutritionalPlan.create.mockRejectedValue(p2002);
      mocks.prisma.nutritionalPlan.findFirst.mockResolvedValue({ id: 'winning-plan', encounterId: 'enc-1', status: 'DRAFT' });

      const result = await service.createOrGet('user-1', 'patient-1', 'enc-1');

      expect(mocks.prisma.nutritionalPlan.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1', status: 'DRAFT' } }),
      );
      expect(result.id).toBe('winning-plan');
    });
  });

  describe('findOne', () => {
    it('returns 404 when the encounter has no Plan yet', async () => {
      mocks.encounters.findAccessibleEncounterForRead.mockResolvedValue({ id: 'enc-1' });
      mocks.prisma.nutritionalPlan.findUnique.mockResolvedValue(null);
      await expect(service.findOne('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
    });

    it('returns 404 for cross-workspace access, delegated to EncountersService.findAccessibleEncounterForRead', async () => {
      mocks.encounters.findAccessibleEncounterForRead.mockRejectedValue(new NotFoundException('Encounter not found'));
      await expect(service.findOne('user-1', 'patient-1', 'enc-1')).rejects.toThrow(NotFoundException);
      expect(mocks.prisma.nutritionalPlan.findUnique).not.toHaveBeenCalled();
    });

    it('returns the mapped Plan when access is valid and it exists', async () => {
      mocks.encounters.findAccessibleEncounterForRead.mockResolvedValue({ id: 'enc-1' });
      mocks.prisma.nutritionalPlan.findUnique.mockResolvedValue({ id: 'plan-1', status: 'DRAFT' });

      const result = await service.findOne('user-1', 'patient-1', 'enc-1');
      expect(result.id).toBe('plan-1');
    });
  });

  describe('recalculate', () => {
    function primeRecalculate(status = 'DRAFT') {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'plan-1', status }]);
      mocks.tx.nutritionalPlan.findFirstOrThrow.mockResolvedValue({ id: 'plan-1', sourceSnapshot: SNAPSHOT });
      mocks.plans.ensureSnapshotV2.mockResolvedValue({ snapshot: SNAPSHOT, upgraded: false });
      mocks.tx.nutritionalPlan.update.mockResolvedValue({ id: 'plan-1', status: 'DRAFT' });
    }

    it('11) reuses the frozen snapshot via PlansService.ensureSnapshotV2 -- never re-fetches Patient/Assessment itself', async () => {
      primeRecalculate();
      await service.recalculate('user-1', 'patient-1', 'enc-1', CONFIG as any);

      expect(mocks.plans.ensureSnapshotV2).toHaveBeenCalledWith(mocks.tx, expect.objectContaining({ id: 'plan-1' }));
      expect(mocks.planCalculation.calculate).toHaveBeenCalledWith(SNAPSHOT, CONFIG);
      expect(mocks.encounters.reconcilePlanningModule).not.toHaveBeenCalled();
    });

    it('does not rewrite sourceSnapshot when it is already v2 (upgraded: false)', async () => {
      primeRecalculate();
      await service.recalculate('user-1', 'patient-1', 'enc-1', CONFIG as any);

      const updateCall = mocks.tx.nutritionalPlan.update.mock.calls[0][0];
      expect(updateCall.data.sourceSnapshot).toBeUndefined();
    });

    it('10) rejects with 409 PLAN_NOT_DRAFT when the Plan is FINALIZED -- FINALIZED is never recalculated', async () => {
      primeRecalculate('FINALIZED');
      await expect(service.recalculate('user-1', 'patient-1', 'enc-1', CONFIG as any)).rejects.toThrow(ConflictException);
      expect(mocks.plans.ensureSnapshotV2).not.toHaveBeenCalled();
    });

    it('rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.recalculate('user-1', 'patient-1', 'enc-1', CONFIG as any)).rejects.toThrow(ConflictException);
      expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('finalize', () => {
    function primeFinalize(overrides: { readiness?: any } = {}) {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'plan-1', status: 'DRAFT' }]);
      mocks.tx.nutritionalPlan.findFirstOrThrow
        .mockResolvedValueOnce({ id: 'plan-1', sourceSnapshot: SNAPSHOT, config: CONFIG })
        .mockResolvedValueOnce({ id: 'plan-1', status: 'FINALIZED', sourceSnapshot: SNAPSHOT, config: CONFIG });
      mocks.planCalculation.evaluateFinalizationReadiness.mockReturnValue(overrides.readiness ?? { canFinalize: true, finalizationBlockers: [] });
      mocks.tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 1 });
    }

    it('6) flips the Plan to FINALIZED via a conditional updateMany', async () => {
      primeFinalize();
      await service.finalize('user-1', 'patient-1', 'enc-1');

      expect(mocks.tx.nutritionalPlan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'plan-1', status: 'DRAFT' }, data: expect.objectContaining({ status: 'FINALIZED' }) }),
      );
    });

    it('7+8) reconciles PLANNING to COMPLETED using the EXACT SAME timestamp as NutritionalPlan.finalizedAt', async () => {
      primeFinalize();
      await service.finalize('user-1', 'patient-1', 'enc-1');

      const finalizedAt = mocks.tx.nutritionalPlan.updateMany.mock.calls[0][0].data.finalizedAt;
      expect(mocks.encounters.reconcilePlanningModule).toHaveBeenCalledWith(mocks.tx, 'enc-1', 'COMPLETED', finalizedAt);
    });

    it('9) finalizationBlockers keep working: rejects with 400 + blockers when evaluateFinalizationReadiness says canFinalize=false', async () => {
      primeFinalize({ readiness: { canFinalize: false, finalizationBlockers: [{ code: 'MISSING_WEIGHT', field: 'weightKg', message: 'x' }] } });

      try {
        await service.finalize('user-1', 'patient-1', 'enc-1');
        fail('expected to throw');
      } catch (e: any) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect(e.getResponse().finalizationBlockers).toEqual([{ code: 'MISSING_WEIGHT', field: 'weightKg', message: 'x' }]);
      }
      expect(mocks.tx.nutritionalPlan.updateMany).not.toHaveBeenCalled();
      expect(mocks.encounters.reconcilePlanningModule).not.toHaveBeenCalled();
    });

    it('10) rejects with 409 PLAN_NOT_DRAFT when the Plan is already FINALIZED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue(IN_PROGRESS_ENCOUNTER);
      mocks.tx.$queryRaw.mockResolvedValue([{ id: 'plan-1', status: 'FINALIZED' }]);

      await expect(service.finalize('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.nutritionalPlan.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the conditional status flip affects 0 rows (lost a concurrent race)', async () => {
      primeFinalize();
      mocks.tx.nutritionalPlan.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.finalize('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.encounters.reconcilePlanningModule).not.toHaveBeenCalled();
    });

    it('19) rejects with 409 ENCOUNTER_NOT_IN_PROGRESS when the encounter is DISCARDED', async () => {
      mocks.encounters.lockEncounterForWrite.mockResolvedValue({ ...IN_PROGRESS_ENCOUNTER, status: 'DISCARDED' });
      await expect(service.finalize('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      expect(mocks.tx.$queryRaw).not.toHaveBeenCalled();
    });

    it('20) rolls back (never partially applies) when reconcilePlanningModule rejects with ENCOUNTER_MODULE_STATE_MISSING', async () => {
      primeFinalize();
      mocks.encounters.reconcilePlanningModule.mockRejectedValue(
        new ConflictException({ code: 'ENCOUNTER_MODULE_STATE_MISSING', message: 'x' }),
      );

      await expect(service.finalize('user-1', 'patient-1', 'enc-1')).rejects.toThrow(ConflictException);
      // El updateMany SÍ se intentó (es anterior a la reconciliación dentro de la
      // misma transacción) -- lo que importa es que Prisma hace ROLLBACK de la
      // transacción completa cuando el callback lanza, revirtiendo también ese
      // updateMany. Este test unitario (con mocks) verifica la propagación del
      // error; el rollback real de PostgreSQL se verifica en el e2e.
      expect(mocks.tx.nutritionalPlan.updateMany).toHaveBeenCalled();
    });
  });
});
