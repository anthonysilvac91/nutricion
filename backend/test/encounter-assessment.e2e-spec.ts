import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Encounter Assessment (e2e)', () => {
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
      .send({ email: `e2e-encasm-${tag}-${Date.now()}-${Math.random()}@test.com`, password: 'password123' })
      .expect(201);
    return { token: res.body.access_token as string, userId: res.body.user.id as string };
  }

  async function createPatient(token: string, firstName: string) {
    const res = await request(app.getHttpServer())
      .post('/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName, lastName: 'EncAsm', sex: 'FEMALE', birthDate: '1990-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
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

  describe('Lifecycle', () => {
    it('creates the Assessment using encounter.clinicalDate, reconciles MEASUREMENTS to IN_PROGRESS, then completes it and reconciles MEASUREMENTS to COMPLETED', async () => {
      const { token } = await registerNutritionist('lifecycle');
      const patientId = await createPatient(token, 'Lifecycle');
      const encounter = await createEncounter(token, patientId, { clinicalDate: '2026-08-04' });

      const createRes = await request(app.getHttpServer())
        .post(assessmentPath(patientId, encounter.id))
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(createRes.body.status).toBe('DRAFT');
      expect(createRes.body.date).toBe('2026-08-04'); // viene de encounter.clinicalDate, no de un input del cliente

      const detailAfterCreate = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detailAfterCreate.body.assessmentId).toBe(createRes.body.id);
      const measurementsModule = detailAfterCreate.body.modules.find((m: any) => m.module === 'MEASUREMENTS');
      expect(measurementsModule.status).toBe('IN_PROGRESS');
      expect(measurementsModule.completedAt).toBeNull();

      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 175 }] })
        .expect(200);

      const completeRes = await request(app.getHttpServer())
        .post(assessmentPath(patientId, encounter.id) + '/complete')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(completeRes.body.status).toBe('COMPLETED');
      expect(completeRes.body.completedAt).not.toBeNull();

      const detailAfterComplete = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const measurementsModuleAfter = detailAfterComplete.body.modules.find((m: any) => m.module === 'MEASUREMENTS');
      expect(measurementsModuleAfter.status).toBe('COMPLETED');
      expect(measurementsModuleAfter.completedAt).not.toBeNull();

      // Historial: sigue apareciendo en el listado de Assessment del paciente y en measurement-summary.
      const listRes = await request(app.getHttpServer())
        .get(`/patients/${patientId}/assessments?status=COMPLETED`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(listRes.body.some((a: any) => a.id === createRes.body.id)).toBe(true);

      await request(app.getHttpServer())
        .get(`/patients/${patientId}/measurement-summary`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('completing with a single measurement still succeeds (MISSING_DATA on derived metrics never blocks the module)', async () => {
      const { token } = await registerNutritionist('missingdata');
      const patientId = await createPatient(token, 'MissingData');
      const encounter = await createEncounter(token, patientId);

      const created = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      const completeRes = await request(app.getHttpServer())
        .post(assessmentPath(patientId, encounter.id) + '/complete')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(completeRes.body.status).toBe('COMPLETED');
      expect(completeRes.body.results.some((r: any) => r.status === 'MISSING_DATA')).toBe(true);
    });

    it('create/get is idempotent across sequential calls', async () => {
      const { token } = await registerNutritionist('idempotent');
      const patientId = await createPatient(token, 'Idempotent');
      const encounter = await createEncounter(token, patientId);

      const first = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      const second = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      expect(second.body.id).toBe(first.body.id);

      const count = await prisma.assessment.count({ where: { encounterId: encounter.id } });
      expect(count).toBe(1);
    });

    it('GET returns 404 when the encounter has no Assessment yet', async () => {
      const { token } = await registerNutritionist('noassessment');
      const patientId = await createPatient(token, 'NoAssessment');
      const encounter = await createEncounter(token, patientId);

      await request(app.getHttpServer()).get(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(404);
    });
  });

  describe('Standalone DRAFT protection', () => {
    it('returns 409 PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT when the patient already has a standalone DRAFT', async () => {
      const { token } = await registerNutritionist('unlinked');
      const patientId = await createPatient(token, 'Unlinked');

      // Borrador standalone vía la ruta legacy (sin ninguna consulta).
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/assessments/draft`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);

      const encounter = await createEncounter(token, patientId);
      const res = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT');
    });
  });

  describe('Legacy route protection', () => {
    it('the legacy PATCH measurements route rejects mutating an Assessment linked to a ClinicalEncounter', async () => {
      const { token } = await registerNutritionist('legacyguard');
      const patientId = await createPatient(token, 'LegacyGuard');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/patients/${patientId}/assessments/${assessment.body.id}/measurements`)
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ASSESSMENT_LINKED_TO_ENCOUNTER');
    });

    it('the legacy draft endpoint refuses to hand back an encounter-linked active DRAFT', async () => {
      const { token } = await registerNutritionist('legacydraft');
      const patientId = await createPatient(token, 'LegacyDraft');
      const encounter = await createEncounter(token, patientId);
      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);

      const res = await request(app.getHttpServer())
        .post(`/patients/${patientId}/assessments/draft`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ASSESSMENT_LINKED_TO_ENCOUNTER');
    });
  });

  describe('Workspace isolation', () => {
    it('cross-workspace access returns 404 on create/get/upsert/complete', async () => {
      const owner = await registerNutritionist('owner');
      const patientId = await createPatient(owner.token, 'Owned');
      const encounter = await createEncounter(owner.token, patientId);

      const stranger = await registerNutritionist('stranger');

      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${stranger.token}`).expect(404);
      await request(app.getHttpServer()).get(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${stranger.token}`).expect(404);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${stranger.token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(404);
      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${stranger.token}`).expect(404);
    });
  });

  describe('Discard interaction', () => {
    it('archives a linked DRAFT Assessment on discard, preserving its MeasurementRecord', async () => {
      const { token } = await registerNutritionist('discarddraft');
      const patientId = await createPatient(token, 'DiscardDraft');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Paciente no se presentó' })
        .expect(201);

      const archived = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id }, include: { measurements: true } });
      expect(archived.status).toBe('ARCHIVED');
      expect(archived.encounterId).toBe(encounter.id); // se conserva para trazabilidad
      expect(archived.measurements).toHaveLength(1); // nunca se borran

      // Al quedar archivado, el paciente puede iniciar una nueva consulta sin
      // chocar con el índice de "un DRAFT por paciente".
      const secondEncounter = await createEncounter(token, patientId, { consultationReason: 'Segunda consulta' });
      await request(app.getHttpServer()).post(assessmentPath(patientId, secondEncounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
    });

    it('preserves a COMPLETED Assessment (and its results) untouched when the encounter is discarded', async () => {
      const { token } = await registerNutritionist('discardcompleted');
      const patientId = await createPatient(token, 'DiscardCompleted');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 175 }] })
        .expect(200);
      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`).expect(201);

      // Un Encounter COMPLETED aún no existe como transición en este corte, así
      // que forzamos IN_PROGRESS -> DISCARDED directo (única transición real
      // disponible) para probar que discard nunca reabre ni archiva un
      // Assessment ya COMPLETED. Esto reproduce fielmente lo que ocurrirá cuando
      // exista una consulta con Assessment COMPLETED y sea descartada por otro motivo.
      await request(app.getHttpServer())
        .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
        .set('Authorization', `Bearer ${token}`)
        .send({ discardReason: 'Registrado por error' })
        .expect(201);

      const preserved = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id }, include: { results: true } });
      expect(preserved.status).toBe('COMPLETED');
      expect(preserved.results.length).toBeGreaterThan(0);
    });
  });

  describe('Concurrency', () => {
    it('A: two simultaneous create/get calls for the same encounter resolve to a single Assessment', async () => {
      const { token } = await registerNutritionist('concA');
      const patientId = await createPatient(token, 'ConcA');
      const encounter = await createEncounter(token, patientId);

      const send = () => request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`);
      const [a, b] = await Promise.all([send(), send()]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.id).toBe(b.body.id);

      const count = await prisma.assessment.count({ where: { encounterId: encounter.id } });
      expect(count).toBe(1);
    });

    it('B: two simultaneous completes resolve to exactly one success and the Assessment ends up COMPLETED exactly once', async () => {
      const { token } = await registerNutritionist('concB');
      const patientId = await createPatient(token, 'ConcB');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      const send = () => request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`);
      const [a, b] = await Promise.all([send(), send()]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);

      const final = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id } });
      expect(final.status).toBe('COMPLETED');

      const detail = await request(app.getHttpServer())
        .get(`/patients/${patientId}/encounters/${encounter.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.modules.find((m: any) => m.module === 'MEASUREMENTS').status).toBe('COMPLETED');
    });

    it('C: complete vs discard never leaves Assessment COMPLETED with module IN_PROGRESS, nor an active DRAFT under a DISCARDED encounter', async () => {
      const { token } = await registerNutritionist('concC');
      const patientId = await createPatient(token, 'ConcC');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      const [completeRes, discardRes] = await Promise.all([
        request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer())
          .post(`/patients/${patientId}/encounters/${encounter.id}/discard`)
          .set('Authorization', `Bearer ${token}`)
          .send({ discardReason: 'Concurrent discard' }),
      ]);

      // discard() SIEMPRE gana eventualmente: completar el Assessment (a nivel
      // de módulo, en este corte) nunca cambia ClinicalEncounter.status, así
      // que nada le impide a discard() proceder sin importar el orden real de
      // los locks -- ambos comparten el lock de ClinicalEncounter (se
      // serializan, nunca corren de verdad en simultáneo), pero eso solo
      // decide si complete() alcanza a ganar la carrera contra el propio
      // discard() (201) o llega tarde y encuentra el Encounter ya DISCARDED (409).
      expect(discardRes.status).toBe(201);
      expect([201, 409]).toContain(completeRes.status);

      const finalAssessment = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id } });
      const finalEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({
        where: { id: encounter.id },
        include: { modules: { where: { module: 'MEASUREMENTS' } } },
      });
      const measurementsModule = finalEncounter.modules[0];

      // El Encounter siempre termina DISCARDED en este escenario (ver arriba).
      expect(finalEncounter.status).toBe('DISCARDED');

      if (completeRes.status === 201) {
        // complete() alcanzó a correr antes que discard(): el Assessment queda
        // COMPLETED (sección 12 -- discard() nunca archiva un COMPLETED) y el
        // módulo queda COMPLETED, de forma coherente entre sí.
        expect(finalAssessment.status).toBe('COMPLETED');
        expect(measurementsModule.status).toBe('COMPLETED');
      } else {
        // discard() corrió primero: el DRAFT se archivó (nunca queda un DRAFT
        // activo bajo un Encounter DISCARDED) y complete() llegó tarde (409).
        expect(finalAssessment.status).toBe('ARCHIVED');
      }
      // En ningún escenario posible queda la combinación inconsistente
      // COMPLETED + módulo IN_PROGRESS, ni un Assessment DRAFT activo bajo un
      // Encounter DISCARDED.
      expect(finalAssessment.status === 'DRAFT' && finalEncounter.status === 'DISCARDED').toBe(false);
      expect(finalAssessment.status === 'COMPLETED' && measurementsModule.status === 'IN_PROGRESS').toBe(false);
    });

    it('D: upsertMeasurements vs complete resolve consistently (one succeeds meaningfully, no corrupted state)', async () => {
      const { token } = await registerNutritionist('concD');
      const patientId = await createPatient(token, 'ConcD');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      const [upsertRes, completeRes] = await Promise.all([
        request(app.getHttpServer())
          .patch(assessmentPath(patientId, encounter.id) + '/measurements')
          .set('Authorization', `Bearer ${token}`)
          .send({ measurements: [{ definitionId: 'm_height', numericValue: 175 }] }),
        request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`),
      ]);

      // Ambas comparten el lock del Assessment -- se serializan, nunca corren
      // de verdad en simultáneo. Los resultados posibles: upsert antes de
      // complete (ambos 2xx) o upsert después de que ya completó (409 DRAFT).
      expect([200, 409]).toContain(upsertRes.status);
      expect(completeRes.status).toBe(201);

      const final = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id } });
      expect(final.status).toBe('COMPLETED');
    });

    it('E: removeMeasurement vs complete resolve consistently', async () => {
      const { token } = await registerNutritionist('concE');
      const patientId = await createPatient(token, 'ConcE');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 175 }] })
        .expect(200);

      const [removeRes, completeRes] = await Promise.all([
        request(app.getHttpServer())
          .delete(assessmentPath(patientId, encounter.id) + '/measurements/m_height')
          .set('Authorization', `Bearer ${token}`),
        request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`),
      ]);

      expect([200, 404, 409]).toContain(removeRes.status);
      expect(completeRes.status).toBe(201);

      const final = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id } });
      expect(final.status).toBe('COMPLETED');
    });

    it('F: legacy createOrGetDraft vs encounter createOrGet racing on the same patient never produce two DRAFT, never 500, and the losing route never returns the winner\'s Assessment', async () => {
      // Se repite varias veces (cada una con paciente/consulta nuevos) para
      // ejercer ambos órdenes reales de la carrera contra el índice único
      // parcial "un DRAFT por paciente". El camino encounter-scoped hace más
      // round-trips antes de su propio INSERT (lock de ClinicalEncounter +
      // 3 SELECT de pre-chequeo) que el legacy (1 SELECT), así que en una
      // carrera perfectamente simultánea el legacy gana casi siempre -- eso
      // por sí solo NO demuestra que el orden inverso esté bien manejado.
      // Para ejercerlo también, la mitad de las iteraciones le da al legacy
      // una ventaja de arranque artificial (unos ms), dejando que el
      // encounter-scoped alcance a insertar primero; siguen siendo dos
      // requests HTTP reales en vuelo, nunca secuenciales de punta a punta.
      const outcomesSeen = new Set<'legacy-won' | 'encounter-won'>();

      for (let i = 0; i < 8; i++) {
        const { token } = await registerNutritionist(`concF${i}`);
        const patientId = await createPatient(token, `ConcF${i}`);
        const encounter = await createEncounter(token, patientId);

        const sendLegacy = () => request(app.getHttpServer()).post(`/patients/${patientId}/assessments/draft`).set('Authorization', `Bearer ${token}`).send({});
        const sendEncounter = () => request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`);
        const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

        const encounterPromise = sendEncounter();
        const legacyPromise = i % 2 === 0 ? sendLegacy() : delay(25).then(sendLegacy);
        const [legacyRes, encounterRes] = await Promise.all([legacyPromise, encounterPromise]);

        // Nunca 500 en ninguno de los dos lados.
        expect(legacyRes.status).not.toBe(500);
        expect(encounterRes.status).not.toBe(500);

        // Exactamente un DRAFT sobrevive para este paciente, sin importar quién ganó.
        const draftCount = await prisma.assessment.count({ where: { patientId, status: 'DRAFT' } });
        expect(draftCount).toBe(1);

        if (legacyRes.status === 201) {
          // Ganó el standalone: el encounter-scoped NUNCA debe reasignarlo
          // silenciosamente, debe rechazar con el código de "borrador sin vincular".
          outcomesSeen.add('legacy-won');
          expect(encounterRes.status).toBe(409);
          const code = encounterRes.body.message?.code ?? encounterRes.body.code;
          expect(code).toBe('PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT');

          const winner = await prisma.assessment.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
          expect(winner.encounterId).toBeNull();
        } else {
          // Ganó el encounter-scoped: la ruta legacy NUNCA debe devolver ese
          // Assessment (ni como lectura), debe rechazar con ASSESSMENT_LINKED_TO_ENCOUNTER.
          outcomesSeen.add('encounter-won');
          expect(encounterRes.status).toBe(201);
          expect(legacyRes.status).toBe(409);
          const code = legacyRes.body.message?.code ?? legacyRes.body.code;
          expect(code).toBe('ASSESSMENT_LINKED_TO_ENCOUNTER');

          const winner = await prisma.assessment.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
          expect(winner.encounterId).toBe(encounter.id);
        }
      }

      // No es un requisito estricto del test (el scheduling real decide), pero
      // se registra para el informe: cuántas de las 8 repeticiones cayeron en
      // cada orden, para documentar que ambos se ejercieron en la práctica.
      // eslint-disable-next-line no-console
      console.log('Escenario F -- órdenes observados en 8 repeticiones:', [...outcomesSeen]);
    });
  });

  describe('GET encounter-assessment authorization hardening', () => {
    it('returns 404 for a structurally inconsistent Encounter (Patient.workspaceId != Encounter.workspaceId), for callers on EITHER side -- never trusts membership of the Encounter\'s own workspace alone', async () => {
      const userA = await registerNutritionist('inconsistentA');
      const patientId = await createPatient(userA.token, 'InconsistentA');
      const encounter = await createEncounter(userA.token, patientId);

      const userB = await registerNutritionist('inconsistentB');
      const patientBId = await createPatient(userB.token, 'InconsistentB');
      const patientB = await prisma.patient.findUniqueOrThrow({ where: { id: patientBId } });

      // Corrompemos deliberadamente el Encounter de A para que apunte al
      // Workspace de B -- nunca alcanzable por la API real (Patient.workspaceId
      // y ClinicalEncounter.workspaceId siempre se asignan juntos en create()),
      // se fuerza directo en la BD para simular el dato inconsistente.
      await prisma.clinicalEncounter.update({ where: { id: encounter.id }, data: { workspaceId: patientB.workspaceId } });

      // Ni el dueño original (cuyo Workspace ya no coincide con el Encounter
      // corrompido) ni un miembro del Workspace al que ahora "apunta" el
      // Encounter (pero que no es el Workspace real del Patient) pueden acceder.
      await request(app.getHttpServer()).get(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${userA.token}`).expect(404);
      await request(app.getHttpServer()).get(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${userB.token}`).expect(404);

      // Las mutaciones ya usaban el mismo JOIN vía lockEncounterForWrite --
      // se confirma que siguen consistentes con el GET recién corregido.
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${userA.token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(404);
      await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${userB.token}`).expect(404);
    });
  });

  describe('MEASUREMENTS module state reconciliation hardening', () => {
    it('rolls back the entire completion when EncounterModuleState.MEASUREMENTS is missing/corrupted -- Assessment stays DRAFT and no CalculatedResult is created', async () => {
      const { token } = await registerNutritionist('modulemissing');
      const patientId = await createPatient(token, 'ModuleMissing');
      const encounter = await createEncounter(token, patientId);
      const assessment = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id)).set('Authorization', `Bearer ${token}`).expect(201);
      await request(app.getHttpServer())
        .patch(assessmentPath(patientId, encounter.id) + '/measurements')
        .set('Authorization', `Bearer ${token}`)
        .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
        .expect(200);

      // Un ClinicalEncounter válido de foundation-v1 siempre nace con su fila
      // EncounterModuleState.MEASUREMENTS -- esto nunca ocurre por la API real,
      // se borra directo en la BD para simular la inconsistencia deliberada.
      await prisma.encounterModuleState.delete({
        where: { encounterId_module: { encounterId: encounter.id, module: 'MEASUREMENTS' } },
      });

      const res = await request(app.getHttpServer()).post(assessmentPath(patientId, encounter.id) + '/complete').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(409);
      const code = res.body.message?.code ?? res.body.code;
      expect(code).toBe('ENCOUNTER_MODULE_STATE_MISSING');

      // Rollback completo: el Assessment nunca quedó a medio completar.
      const finalAssessment = await prisma.assessment.findUniqueOrThrow({ where: { id: assessment.body.id }, include: { results: true } });
      expect(finalAssessment.status).toBe('DRAFT');
      expect(finalAssessment.completedAt).toBeNull();
      expect(finalAssessment.results).toHaveLength(0);
    });
  });
});
