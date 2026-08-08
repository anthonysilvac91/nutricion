import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Encounters (e2e)', () => {
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
      .send({ email: `e2e-encounters-${tag}-${Date.now()}-${Math.random()}@test.com`, password: 'password123' })
      .expect(201);
    return { token: res.body.access_token as string, userId: res.body.user.id as string };
  }

  async function createPatient(token: string, firstName: string) {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName,
        lastName: 'Encounter',
        sex: 'FEMALE',
        birthDate: '1990-01-01T00:00:00.000Z',
        activityLevel: 'MODERATE',
      })
      .expect(201);
    return res.body.id as string;
  }

  function createEncounterBody(overrides: Record<string, any> = {}) {
    return {
      profile: 'ADULT_GENERAL',
      type: 'FIRST_VISIT',
      clinicalDate: '2026-08-04',
      consultationReason: 'Control nutricional',
      notes: 'Texto opcional',
      ...overrides,
    };
  }

  describe('Adult flow', () => {
    let token: string;
    let patientId: string;
    let encounterId: string;

    beforeAll(async () => {
      const auth = await registerNutritionist('adult');
      token = auth.token;
      patientId = await createPatient(token, 'Adult');
    });

    it('creates and immediately starts the encounter (IN_PROGRESS, foundation-v1, 9 modules matching the adult matrix)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEncounterBody())
        .expect(201);

      encounterId = res.body.id;
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.flowVersion).toBe('foundation-v1');
      expect(res.body.clinicalDate).toBe('2026-08-04');
      expect(res.body.consultationReason).toBe('Control nutricional');
      expect(res.body.discardedAt).toBeNull();
      expect(res.body.discardReason).toBeNull();
      expect(res.body.modules).toHaveLength(9);

      const byModule = Object.fromEntries(res.body.modules.map((m: any) => [m.module, m]));
      expect(byModule.SUMMARY.applicability).toBe('NOT_APPLICABLE');
      expect(byModule.SUMMARY.status).toBe('NOT_APPLICABLE');
      expect(byModule.ANAMNESIS.applicability).toBe('REQUIRED');
      expect(byModule.ANAMNESIS.status).toBe('PENDING');
      expect(byModule.MEASUREMENTS.applicability).toBe('REQUIRED');
      expect(byModule.REQUIREMENTS.applicability).toBe('REQUIRED');
      expect(byModule.PLANNING.applicability).toBe('REQUIRED');
      expect(byModule.MEAL_PLAN.applicability).toBe('OPTIONAL');
      expect(byModule.INDICATIONS.applicability).toBe('REQUIRED');
      expect(byModule.REPORT.applicability).toBe('OPTIONAL');
      expect(byModule.FOLLOW_UP.applicability).toBe('OPTIONAL');

      // Orden determinístico según la matriz, no el orden de inserción de Postgres.
      expect(res.body.modules.map((m: any) => m.module)).toEqual([
        'SUMMARY', 'ANAMNESIS', 'MEASUREMENTS', 'REQUIREMENTS', 'PLANNING', 'MEAL_PLAN', 'INDICATIONS', 'REPORT', 'FOLLOW_UP',
      ]);
    });

    it('lists the encounter in the patient history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(encounterId);
      expect(res.body.data[0].status).toBe('IN_PROGRESS');
      // 9 módulos - 1 NOT_APPLICABLE (SUMMARY, único NOT_APPLICABLE en el perfil adulto) = 8.
      expect(res.body.data[0].progress).toEqual({ completed: 0, total: 8 });
      expect(res.body.meta).toEqual({ total: 1, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('returns the encounter detail with progress', async () => {
      const res = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(encounterId);
      expect(res.body.notes).toBe('Texto opcional');
      expect(res.body.progress.completed).toBe(0);
    });

    it('discards the encounter, setting discardedAt/discardReason without touching consultationReason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounterId}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Paciente no se presentó' })
        .expect(201);

      expect(res.body.status).toBe('DISCARDED');
      expect(res.body.discardedAt).not.toBeNull();
      expect(res.body.discardReason).toBe('Paciente no se presentó');
      expect(res.body.consultationReason).toBe('Control nutricional');
    });

    it('rejects a second discard with 409 ENCOUNTER_NOT_IN_PROGRESS', async () => {
      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounterId}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Segundo intento' })
        .expect(409);

      expect(res.body.message?.code ?? res.body.code).toBeDefined();
    });

    it('allows starting a new encounter for the same patient after the previous one was discarded', async () => {
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEncounterBody({ consultationReason: 'Segunda consulta' }))
        .expect(201);
    });
  });

  describe('Pediatric flow', () => {
    it('PLANNING and MEAL_PLAN are NOT_APPLICABLE; INDICATIONS is REQUIRED; REPORT is OPTIONAL', async () => {
      const { token } = await registerNutritionist('pediatric');
      const patientId = await createPatient(token, 'Pediatric');

      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEncounterBody({ profile: 'PEDIATRIC', type: 'FIRST_VISIT' }))
        .expect(201);

      const byModule = Object.fromEntries(res.body.modules.map((m: any) => [m.module, m]));
      expect(byModule.PLANNING.applicability).toBe('NOT_APPLICABLE');
      expect(byModule.MEAL_PLAN.applicability).toBe('NOT_APPLICABLE');
      expect(byModule.INDICATIONS.applicability).toBe('REQUIRED');
      expect(byModule.REPORT.applicability).toBe('OPTIONAL');
    });
  });

  describe('Concurrency', () => {
    it('exactly one of two simultaneous creations for the same patient succeeds; the DB ends up with one IN_PROGRESS encounter and nine module states', async () => {
      const { token } = await registerNutritionist('concurrency');
      const patientId = await createPatient(token, 'Concurrency');

      const send = () =>
        request(app.getHttpServer())
          .post(`/patients/${patientId}/encounters`)
          .set('Authorization', `Bearer ${token}`)
          .send(createEncounterBody());

      const [resA, resB] = await Promise.all([send(), send()]);
      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([201, 409]);

      const inProgress = await prisma.clinicalEncounter.findMany({ where: { patientId, status: 'IN_PROGRESS' } });
      expect(inProgress).toHaveLength(1);

      const modules = await prisma.encounterModuleState.findMany({ where: { encounterId: inProgress[0].id } });
      expect(modules).toHaveLength(9);
    });
  });

  describe('Security (workspace isolation)', () => {
    it('another workspace gets 404 on list, detail and discard', async () => {
      const owner = await registerNutritionist('owner');
      const patientId = await createPatient(owner.token, 'Owned');
      const createRes = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send(createEncounterBody())
        .expect(201);
      const encounterId = createRes.body.id;

      const stranger = await registerNutritionist('stranger');

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounterId}`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .expect(404);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounterId}/discard`)
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ discardReason: 'Intento cruzado' })
        .expect(404);
    });
  });

  describe('Patient deletion protection', () => {
    it('cannot delete a patient with a ClinicalEncounter (409 PATIENT_HAS_CLINICAL_ENCOUNTERS), and the encounter survives', async () => {
      const { token } = await registerNutritionist('deletion');
      const patientId = await createPatient(token, 'ToDelete');
      const createRes = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEncounterBody())
        .expect(201);

      const deleteRes = await request(app.getHttpServer())
        .delete(`/patients/${patientId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
      const code = deleteRes.body.message?.code ?? deleteRes.body.code;
      expect(code).toBe('PATIENT_HAS_CLINICAL_ENCOUNTERS');

      const stillThere = await prisma.clinicalEncounter.findUnique({ where: { id: createRes.body.id } });
      expect(stillThere).not.toBeNull();
    });

    it('does not mislabel a foreign-key conflict from another relation (Assessment) as PATIENT_HAS_CLINICAL_ENCOUNTERS', async () => {
      const { token } = await registerNutritionist('del-other-fk');
      const patientId = await createPatient(token, 'HasAssessmentOnly');

      // Assessment referencia a Patient sin cascade (igual que antes de este corte) --
      // el paciente no tiene ningún ClinicalEncounter.
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/assessments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ date: '2026-03-01T10:00:00.000Z', measurements: [{ definitionId: 'm_weight', numericValue: 80 }] })
        .expect(201);

      const encounterCount = await prisma.clinicalEncounter.count({ where: { patientId } });
      expect(encounterCount).toBe(0);

      const deleteRes = await request(app.getHttpServer()).delete(`/patients/${patientId}`).set('Authorization', `Bearer ${token}`);
      expect(deleteRes.status).not.toBe(409);
      const code = deleteRes.body.message?.code ?? deleteRes.body.code;
      expect(code).not.toBe('PATIENT_HAS_CLINICAL_ENCOUNTERS');
    });
  });

  // "Patient with workspaceId null" (PATIENT_WORKSPACE_NOT_READY / 404 sobre
  // un Patient con workspaceId null) se eliminó tras la Migración B
  // (require_patient_workspace): la columna es NOT NULL a nivel de Postgres,
  // así que ese estado ya no es representable ni con un UPDATE directo --
  // Prisma ni siquiera permite compilar `data: { workspaceId: null }` contra
  // el tipo generado. La garantía que ese test buscaba (ningún Patient sin
  // Workspace) ahora la da la base de datos misma, no la capa de aplicación.

  describe('Discard validation', () => {
    it('rejects a discardReason made only of whitespace with 400', async () => {
      const { token } = await registerNutritionist('discard-ws');
      const patientId = await createPatient(token, 'DiscardWhitespace');
      const createRes = await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters`)
        .set('Authorization', `Bearer ${token}`)
        .send(createEncounterBody())
        .expect(201);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${createRes.body.id}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: '     ' })
        .expect(400);

      const stillInProgress = await prisma.clinicalEncounter.findUniqueOrThrow({ where: { id: createRes.body.id } });
      expect(stillInProgress.status).toBe('IN_PROGRESS');
    });
  });

  describe('Compatibility', () => {
    it('existing Patient endpoints keep working unmodified', async () => {
      const { token } = await registerNutritionist('compat');
      const patientId = await createPatient(token, 'Compat');

      await request(app.getHttpServer()).get(`/patients/${patientId}`).set('Authorization', `Bearer ${token}`).expect(200);
      await request(app.getHttpServer()).get('/patients').set('Authorization', `Bearer ${token}`).expect(200);
    });
  });
});
