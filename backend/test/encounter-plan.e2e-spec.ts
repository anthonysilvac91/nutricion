import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Encounter Plan (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerNutritionist(tag: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: `e2e-encplan-${tag}-${Date.now()}-${Math.random()}@test.com`, password: 'password123' })
      .expect(201);
    return { token: res.body.access_token as string, userId: res.body.user.id as string };
  }

  async function createPatient(token: string, firstName: string) {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName, lastName: 'EncPlan', sex: 'FEMALE', birthDate: '1990-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
      .expect(201);
    return res.body.id as string;
  }

  async function createEncounter(token: string, patientId: string, overrides: Record<string, any> = {}) {
    const res = await request(app.getHttpServer())
      .post(`/patients/${patientId}/encounters`)
      .set('Authorization', `Bearer ${token}`)
      .send({ profile: 'ADULT_GENERAL', type: 'FIRST_VISIT', clinicalDate: '2026-08-04', consultationReason: 'Control', ...overrides })
      .expect(201);
    return res.body;
  }

  const assessmentPath = (patientId: string, encounterId: string) => `/patients/${patientId}/encounters/${encounterId}/assessment`;
  const planPath = (patientId: string, encounterId: string) => `/patients/${patientId}/encounters/${encounterId}/plan`;

  /** Crea y completa el Assessment de la consulta con peso+estatura -- suficiente para canFinalize=true con la config por defecto. */
  async function completeAssessment(token: string, patientId: string, encounterId: string) {
    const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounterId)).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer())
      .patch(assessmentPath(patientId, encounterId) + '/measurements')
      .set('Authorization', `Bearer ${token}`)
      .send({ measurements: [{ definitionId: 'm_weight', numericValue: 65 }, { definitionId: 'm_height', numericValue: 165 }] })
      .expect(200);
    const completed = await request(app.getHttpServer()).post(assessmentPath(patientId, encounterId) + '/complete').set('Authorization', `Bearer ${token}`).expect(201);
    return completed.body;
  }

  const VALID_RECALCULATE = {
    bmrFormulaId: 'BMR_MIFFLIN_ST_JEOR_V1',
    pal: 1.725,
    macroMethod: 'PERCENT',
    macroPercents: { PROTEIN: 20, CARBS: 50, FAT: 30 },
    fiberSourceId: 'FIBER_EFSA_V1',
    waterSourceId: 'WATER_MLKG_V1',
  };

  describe('Lifecycle', () => {
    it('creates the Plan using EXACTLY encounter.assessment, reconciles PLANNING to IN_PROGRESS, then finalizes it and reconciles PLANNING to COMPLETED', async () => {
      const { token } = await registerNutritionist('lifecycle');
      const patientId = await createPatient(token, 'Lifecycle');
      const encounter = await createEncounter(token, patientId);
      const assessment = await completeAssessment(token, patientId, encounter.id);

      const createRes = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      expect(createRes.body.status).toBe('DRAFT');
      expect(createRes.body.assessmentId).toBe(assessment.id);

      const detailAfterCreate = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detailAfterCreate.body.nutritionalPlanId).toBe(createRes.body.id);
      const planningModule = detailAfterCreate.body.modules.find((m: any) => m.module === 'PLANNING');
      expect(planningModule.status).toBe('IN_PROGRESS');
      expect(planningModule.completedAt).toBeNull();

      const getRes = await request(app.getHttpServer()).get(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(200);
      expect(getRes.body.canFinalize).toBe(true);

      const finalizeRes = await request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${token}`).expect(201);
      expect(finalizeRes.body.status).toBe('FINALIZED');
      expect(finalizeRes.body.finalizedAt).not.toBeNull();

      const detailAfterFinalize = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const planningModuleAfter = detailAfterFinalize.body.modules.find((m: any) => m.module === 'PLANNING');
      expect(planningModuleAfter.status).toBe('COMPLETED');
      expect(planningModuleAfter.completedAt).not.toBeNull();

      // Historial: sigue apareciendo en el listado de planes del paciente.
      const listRes = await request(app.getHttpServer()).get(`/patients/${patientId}/plans`).set('Authorization', `Bearer ${token}`).expect(200);
      expect(listRes.body.some((p: any) => p.id === createRes.body.id)).toBe(true);
    });

    it('recalculate reuses the frozen snapshot and keeps PLANNING IN_PROGRESS', async () => {
      const { token } = await registerNutritionist('recalc');
      const patientId = await createPatient(token, 'Recalc');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const recalcRes = await request(app.getHttpServer())
        .post(planPath(patientId, encounter.id) + '/recalculate')
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_RECALCULATE)
        .expect(201);
      expect(recalcRes.body.results.bmrKcal.formulaUsed).toBe('BMR_MIFFLIN_ST_JEOR_V1');
      expect(recalcRes.body.status).toBe('DRAFT');

      const detail = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.modules.find((m: any) => m.module === 'PLANNING').status).toBe('IN_PROGRESS');
    });

    it('create/get is idempotent across sequential calls', async () => {
      const { token } = await registerNutritionist('idempotent');
      const patientId = await createPatient(token, 'Idempotent');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);

      const first = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      const second = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      expect(second.body.id).toBe(first.body.id);

      const count = await prisma.nutritionalPlan.count({ where: { encounterId: encounter.id } });
      expect(count).toBe(1);
    });

    it('GET returns 404 when the encounter has no Plan yet', async () => {
      const { token } = await registerNutritionist('noplan');
      const patientId = await createPatient(token, 'NoPlan');
      const encounter = await createEncounter(token, patientId);
      await request(app.getHttpServer()).get(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(404);
    });
  });

  describe('Assessment preconditions', () => {
    it('returns 409 ENCOUNTER_ASSESSMENT_REQUIRED when the encounter has no Assessment yet', async () => {
      const { token } = await registerNutritionist('noassessment');
      const patientId = await createPatient(token, 'NoAssessment');
      const encounter = await createEncounter(token, patientId);

      const res = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ENCOUNTER_ASSESSMENT_REQUIRED');
    });

    it('returns 409 ENCOUNTER_ASSESSMENT_NOT_COMPLETED when the Assessment is still DRAFT', async () => {
      const { token } = await registerNutritionist('notcompleted');
      const patientId = await createPatient(token, 'NotCompleted');
      const encounter = await createEncounter(token, patientId);
      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const res = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ENCOUNTER_ASSESSMENT_NOT_COMPLETED');
    });
  });

  describe('Pediatric / applicability', () => {
    it('rejects Plan creation with 409 ENCOUNTER_MODULE_NOT_APPLICABLE for a PEDIATRIC encounter, even with zero Assessment activity', async () => {
      const { token } = await registerNutritionist('pediatric');
      const patientId = await createPatient(token, 'Pediatric');
      const encounter = await createEncounter(token, patientId, { profile: 'PEDIATRIC' });

      const res = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ENCOUNTER_MODULE_NOT_APPLICABLE');

      const detail = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.modules.find((m: any) => m.module === 'PLANNING').applicability).toBe('NOT_APPLICABLE');
      expect(detail.body.nutritionalPlanId).toBeNull();
    });
  });

  describe('Standalone DRAFT protection', () => {
    it('returns 409 PATIENT_HAS_UNLINKED_DRAFT_PLAN when the patient already has a standalone DRAFT plan', async () => {
      const { token } = await registerNutritionist('unlinked');
      const patientId = await createPatient(token, 'Unlinked');

      // Assessment + plan standalone vía las rutas legacy (sin ninguna consulta).
      const legacyAssessment = await request(app.getHttpServer())
        .post(`/patients/${patientId}/assessments/draft`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/patients/${patientId}/assessments/${legacyAssessment.body.id}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 65 }, { definitionId: 'm_height', numericValue: 165 }] })
        .expect(200);
      const legacyCompleted = await request(app.getHttpServer())
        .post(`/patients/${patientId}/assessments/${legacyAssessment.body.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assessmentId: legacyCompleted.body.id })
        .expect(201);

      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const res = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('PATIENT_HAS_UNLINKED_DRAFT_PLAN');
    });
  });

  describe('Legacy route protection', () => {
    it('the legacy recalculate/finalize routes reject mutating a Plan linked to a ClinicalEncounter', async () => {
      const { token } = await registerNutritionist('legacyguard');
      const patientId = await createPatient(token, 'LegacyGuard');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const recalcRes = await request(app.getHttpServer())
        .post(`/patients/${patientId}/plans/${plan.body.id}/recalculate`)
        .set('Authorization', `Bearer ${token}`)
        .send(VALID_RECALCULATE)
        .expect(409);
      expect(recalcRes.body.message?.code ?? recalcRes.body.code).toBe('PLAN_LINKED_TO_ENCOUNTER');

      const finalizeRes = await request(app.getHttpServer())
        .post(`/patients/${patientId}/plans/${plan.body.id}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
      expect(finalizeRes.body.message?.code ?? finalizeRes.body.code).toBe('PLAN_LINKED_TO_ENCOUNTER');
    });

    it('the legacy create-plan endpoint refuses to hand back an encounter-linked active DRAFT', async () => {
      const { token } = await registerNutritionist('legacycreate');
      const patientId = await createPatient(token, 'LegacyCreate');
      const encounter = await createEncounter(token, patientId);
      const assessment = await completeAssessment(token, patientId, encounter.id);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assessmentId: assessment.id })
        .expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('PLAN_LINKED_TO_ENCOUNTER');
    });
  });

  describe('Workspace isolation', () => {
    it('cross-workspace access returns 404 on create/get/recalculate/finalize', async () => {
      const owner = await registerNutritionist('owner');
      const patientId = await createPatient(owner.token, 'Owned');
      const encounter = await createEncounter(owner.token, patientId);
      await completeAssessment(owner.token, patientId, encounter.id);

      const stranger = await registerNutritionist('stranger');

      await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${stranger.token}`).expect(404);
      await request(app.getHttpServer()).get(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${stranger.token}`).expect(404);
      await request(app.getHttpServer())
        .post(planPath(patientId, encounter.id) + '/recalculate')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send(VALID_RECALCULATE)
        .expect(404);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${stranger.token}`).expect(404);
    });

    it('returns 404 for a structurally inconsistent Encounter (Patient.workspaceId != Encounter.workspaceId), for callers on EITHER side', async () => {
      const userA = await registerNutritionist('inconsistentA');
      const patientId = await createPatient(userA.token, 'InconsistentA');
      const encounter = await createEncounter(userA.token, patientId);
      await completeAssessment(userA.token, patientId, encounter.id);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${userA.token}`).expect(201);

      const userB = await registerNutritionist('inconsistentB');
      const patientBId = await createPatient(userB.token, 'InconsistentB');
      const patientB = await prisma.patient.findUniqueOrThrow({ where: { id: patientBId } });

      await prisma.clinicalEncounter.update({ where: { id: encounter.id }, data: { workspaceId: patientB.workspaceId } });

      await request(app.getHttpServer()).get(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${userA.token}`).expect(404);
      await request(app.getHttpServer()).get(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${userB.token}`).expect(404);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${userA.token}`).expect(404);
    });
  });

  describe('Discard interaction', () => {
    it('archives a linked DRAFT Plan on discard, preserving sourceSnapshot/calculationResults/config', async () => {
      const { token } = await registerNutritionist('discarddraft');
      const patientId = await createPatient(token, 'DiscardDraft');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Paciente no se presentó' })
        .expect(201);

      const archived = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: plan.body.id } });
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.encounterId).toBe(encounter.id); // se conserva para trazabilidad
      expect(archived.sourceSnapshot).not.toBeNull();
      expect(archived.calculationResults).not.toBeNull();
      expect(archived.config).not.toBeNull();

      // Al quedar archivado, el paciente puede iniciar una nueva consulta sin
      // chocar con el índice de "un DRAFT por paciente".
      const secondEncounter = await createEncounter(token, patientId, { consultationReason: 'Segunda consulta' });
      await completeAssessment(token, patientId, secondEncounter.id);
      await request(app.getHttpServer()).post(planPath(patientId, secondEncounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
    });

    it('preserves a FINALIZED Plan (and its results) untouched when the encounter is discarded', async () => {
      const { token } = await registerNutritionist('discardfinalized');
      const patientId = await createPatient(token, 'DiscardFinalized');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${token}`).expect(201);

      // Un Encounter COMPLETED aún no existe (corte 5) -- forzamos IN_PROGRESS ->
      // DISCARDED directo para probar que discard nunca reabre ni archiva un
      // Plan ya FINALIZED.
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Registrado por error' })
        .expect(201);

      const preserved = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: plan.body.id } });
      expect(preserved.status).toBe('FINALIZED');
      expect(preserved.finalizedAt).not.toBeNull();
    });
  });

  describe('Concurrency', () => {
    it('A: two simultaneous create/get calls for the same encounter resolve to a single Plan', async () => {
      const { token } = await registerNutritionist('concA');
      const patientId = await createPatient(token, 'ConcA');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);

      const send = () => request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`);
      const [a, b] = await Promise.all([send(), send()]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.id).toBe(b.body.id);

      const count = await prisma.nutritionalPlan.count({ where: { encounterId: encounter.id } });
      expect(count).toBe(1);
    });

    it('B: two simultaneous finalizes resolve to exactly one success and the Plan ends up FINALIZED exactly once', async () => {
      const { token } = await registerNutritionist('concB');
      const patientId = await createPatient(token, 'ConcB');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const send = () => request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${token}`);
      const [a, b] = await Promise.all([send(), send()]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);

      const final = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: plan.body.id } });
      expect(final.status).toBe('FINALIZED');

      const detail = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.modules.find((m: any) => m.module === 'PLANNING').status).toBe('COMPLETED');
    });

    it('C: recalculate vs finalize resolve consistently -- FINALIZED ends up immutable', async () => {
      const { token } = await registerNutritionist('concC');
      const patientId = await createPatient(token, 'ConcC');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const [recalcRes, finalizeRes] = await Promise.all([
        request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/recalculate').set('Authorization', `Bearer ${token}`).send(VALID_RECALCULATE),
        request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${token}`),
      ]);

      // Ambas comparten el lock del Plan -- se serializan, nunca corren de
      // verdad en simultáneo. Resultados posibles: recalculate antes de
      // finalize (ambos 2xx) o recalculate después de que ya finalizó (409 PLAN_NOT_DRAFT).
      expect([201, 409]).toContain(recalcRes.status);
      expect(finalizeRes.status).toBe(201);

      const final = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: plan.body.id } });
      expect(final.status).toBe('FINALIZED');
    });

    it('D: finalize vs discard never leaves Plan FINALIZED with module IN_PROGRESS, nor an active DRAFT under a DISCARDED encounter', async () => {
      const { token } = await registerNutritionist('concD');
      const patientId = await createPatient(token, 'ConcD');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);
      const plan = await request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const [finalizeRes, discardRes] = await Promise.all([
        request(app.getHttpServer()).post(planPath(patientId, encounter.id) + '/finalize').set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
          .set('Authorization', `Bearer ${token}`)
          .send({ discardReason: 'Concurrent discard' }),
      ]);

      // discard() nunca depende de si el Plan finalizó -- finalize() nunca
      // muta ClinicalEncounter.status (eso llega recién en el corte 5), así
      // que discard() siempre puede proceder: 201 siempre.
      expect(discardRes.status).toBe(201);
      expect([201, 409]).toContain(finalizeRes.status);

      const finalPlan = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: plan.body.id } });
      const finalEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({
        where: { id: encounter.id },
        include: { modules: { where: { module: 'PLANNING' } } },
      });
      const planningModule = finalEncounter.modules[0];

      expect(finalEncounter.status).toBe('DISCARDED');

      if (finalizeRes.status === 201) {
        expect(finalPlan.status).toBe('FINALIZED');
        expect(planningModule.status).toBe('COMPLETED');
      } else {
        expect(finalPlan.status).toBe('ARCHIVED');
      }
      expect(finalPlan.status === 'DRAFT' && finalEncounter.status === 'DISCARDED').toBe(false);
      expect(finalPlan.status === 'FINALIZED' && planningModule.status === 'IN_PROGRESS').toBe(false);
    });

    it('E: create vs discard never creates a Plan DRAFT after the encounter ends up DISCARDED', async () => {
      const { token } = await registerNutritionist('concE');
      const patientId = await createPatient(token, 'ConcE');
      const encounter = await createEncounter(token, patientId);
      await completeAssessment(token, patientId, encounter.id);

      const [createRes, discardRes] = await Promise.all([
        request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
          .set('Authorization', `Bearer ${token}`)
          .send({ discardReason: 'Concurrent discard before plan exists' }),
      ]);

      expect(discardRes.status).toBe(201);
      expect([201, 409]).toContain(createRes.status);

      const finalEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({ where: { id: encounter.id } });
      expect(finalEncounter.status).toBe('DISCARDED');

      if (createRes.status === 201) {
        // El create() ganó la carrera del lock antes que discard() -- el Plan
        // creado queda DRAFT bajo un Encounter que luego se descarta, así que
        // discard() (que corrió después, dentro de su propio lock) ya lo
        // archivó en la MISMA operación de discard.
        const plan = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: createRes.body.id } });
        expect(plan.status).toBe('ARCHIVED');
      }
    });

    it('F: legacy createOrGetDraft vs encounter createOrGet racing on the same patient never produce two DRAFT, never 500, and the losing route never returns the winner\'s Plan', async () => {
      const outcomesSeen = new Set<'legacy-won' | 'encounter-won'>();

      for (let i = 0; i < 8; i++) {
        const { token } = await registerNutritionist(`concF${i}`);
        const patientId = await createPatient(token, `ConcF${i}`);
        const encounter = await createEncounter(token, patientId);
        // El mismo Assessment COMPLETED de la consulta es una referencia
        // válida para la ruta legacy también -- loadCompletedAssessment solo
        // exige patientId + status COMPLETED, nunca "sin vincular a ningún
        // Encounter" (esa reasignación solo importa para el NutritionalPlan
        // resultante, no para el Assessment fuente).
        const assessment = await completeAssessment(token, patientId, encounter.id);

        const sendLegacy = () =>
          request(app.getHttpServer()).post(`/patients/${patientId}/plans`).set('Authorization', `Bearer ${token}`).send({ assessmentId: assessment.id });
        const sendEncounter = () => request(app.getHttpServer()).post(planPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`);
        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const encounterPromise = sendEncounter();
        const legacyPromise = i % 2 === 0 ? sendLegacy() : delay(25).then(sendLegacy);
        const [legacyRes, encounterRes] = await Promise.all([legacyPromise, encounterPromise]);

        expect(legacyRes.status).not.toBe(500);
        expect(encounterRes.status).not.toBe(500);

        const draftCount = await prisma.nutritionalPlan.count({ where: { patientId, status: 'DRAFT' } });
        expect(draftCount).toBe(1);

        if (legacyRes.status === 201) {
          outcomesSeen.add('legacy-won');
          expect(encounterRes.status).toBe(409);
          const code = encounterRes.body.message?.code ?? encounterRes.body.code;
          expect(code).toBe('PATIENT_HAS_UNLINKED_DRAFT_PLAN');

          const winner = await prisma.nutritionalPlan.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
          expect(winner.encounterId).toBeNull();
        } else {
          outcomesSeen.add('encounter-won');
          expect(encounterRes.status).toBe(201);
          expect(legacyRes.status).toBe(409);
          const code = legacyRes.body.message?.code ?? legacyRes.body.code;
          expect(code).toBe('PLAN_LINKED_TO_ENCOUNTER');

          const winner = await prisma.nutritionalPlan.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
          expect(winner.encounterId).toBe(encounter.id);
        }
      }

      // eslint-disable-next-line no-console
      console.log('Escenario F (Plan) -- órdenes observados en 8 repeticiones:', [...outcomesSeen]);
    });
  });
});
