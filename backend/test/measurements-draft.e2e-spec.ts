import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Measurements DRAFT lifecycle (e2e)', () => {
    let app: INestApplication;
    let token: string;
    let patientId: string;
    let concurrencyPatientId: string;
    let firstAssessmentId: string;
    let secondAssessmentId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        // 1. Registro/login del nutricionista
        const resAuth = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: `e2e-draft-${Date.now()}@test.com`, password: 'password123' })
            .expect(201);
        token = resAuth.body.access_token;

        // 2. Crear paciente adulto (narrativa numerada principal)
        const resPatient = await request(app.getHttpServer())
            .post('/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({
                firstName: 'Draft',
                lastName: 'Patient',
                sex: 'FEMALE',
                birthDate: '1994-01-01T00:00:00.000Z',
                activityLevel: 'MODERATE',
            })
            .expect(201);
        patientId = resPatient.body.id;

        // Paciente aparte solo para las pruebas de concurrencia -- así no contaminan el
        // historial que la narrativa numerada 3-17 verifica paso a paso.
        const resConcurrencyPatient = await request(app.getHttpServer())
            .post('/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({
                firstName: 'Concurrency',
                lastName: 'Patient',
                sex: 'MALE',
                birthDate: '1990-01-01T00:00:00.000Z',
                activityLevel: 'MODERATE',
            })
            .expect(201);
        concurrencyPatientId = resConcurrencyPatient.body.id;
    });

    afterAll(async () => {
        await app.close();
    });

    it('3. crea un Assessment DRAFT', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-06-15' })
            .expect(201);

        expect(res.body.status).toBe('DRAFT');
        firstAssessmentId = res.body.id;
    });

    it('POST draft again returns the same DRAFT instead of creating a second one', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({})
            .expect(201);
        expect(res.body.id).toBe(firstAssessmentId);
    });

    it('4-5-6. agrega peso y estatura por separado y ambos caen en el mismo assessmentId', async () => {
        const resWeight = await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 72.4 }] })
            .expect(200);
        expect(resWeight.body.id).toBe(firstAssessmentId);
        expect(resWeight.body.measurements.find((m: any) => m.definitionId === 'm_weight').numericValue).toBe(72.4);

        const resHeight = await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_height', numericValue: 165 }] })
            .expect(200);
        expect(resHeight.body.id).toBe(firstAssessmentId);
        expect(resHeight.body.measurements.length).toBe(2);
        expect(resHeight.body.measurements.map((m: any) => m.definitionId).sort()).toEqual(['m_height', 'm_weight']);
    });

    it('7-8. measurement-summary refleja peso y estatura en el draft', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/measurement-summary`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.activeDraft).toEqual(expect.objectContaining({ id: firstAssessmentId, measurementCount: 2 }));
        const weightCard = res.body.cards.find((c: any) => c.definitionId === 'm_weight');
        const heightCard = res.body.cards.find((c: any) => c.definitionId === 'm_height');
        expect(weightCard.draft).toEqual(expect.objectContaining({ value: 72.4 }));
        expect(heightCard.draft).toEqual(expect.objectContaining({ value: 165 }));
        expect(weightCard.latestCompleted).toBeNull();
    });

    it('9-10. completa la evaluación y corre el motor clínico (BMI, BMR, TDEE)', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/${firstAssessmentId}/complete`)
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        expect(res.body.status).toBe('COMPLETED');
        expect(res.body.completedAt).toBeDefined();

        const bmi = res.body.results.find((r: any) => r.metricId === 'BMI');
        const bmr = res.body.results.find((r: any) => r.metricId === 'BMR');
        const tdee = res.body.results.find((r: any) => r.metricId === 'TDEE');
        expect(bmi.status).toBe('CALCULATED');
        expect(bmr.status).toBe('CALCULATED');
        expect(tdee.status).toBe('CALCULATED');
    });

    it('no permite editar ni eliminar mediciones de una evaluación COMPLETED (409, no 400 -- es un conflicto de estado)', async () => {
        await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 99 }] })
            .expect(409);

        await request(app.getHttpServer())
            .delete(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements/m_weight`)
            .set('Authorization', `Bearer ${token}`)
            .expect(409);
    });

    it('completar la misma evaluación de nuevo devuelve 409 y no duplica resultados', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/${firstAssessmentId}/complete`)
            .set('Authorization', `Bearer ${token}`)
            .expect(409);

        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/assessments/${firstAssessmentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        const bmiResults = res.body.results.filter((r: any) => r.metricId === 'BMI');
        expect(bmiResults.length).toBe(1);
    });

    it('11-12. crea un segundo DRAFT y registra un peso nuevo', async () => {
        const resDraft = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-07-26' })
            .expect(201);
        secondAssessmentId = resDraft.body.id;
        expect(secondAssessmentId).not.toBe(firstAssessmentId);

        await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${secondAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
            .expect(200);
    });

    it('13-14. measurement-summary muestra el peso nuevo en el draft, el peso viejo como latestCompleted, y la estatura histórica sin desaparecer', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/measurement-summary`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const weightCard = res.body.cards.find((c: any) => c.definitionId === 'm_weight');
        const heightCard = res.body.cards.find((c: any) => c.definitionId === 'm_height');

        expect(weightCard.draft).toEqual(expect.objectContaining({ value: 70 }));
        expect(weightCard.latestCompleted).toEqual(expect.objectContaining({ value: 72.4, assessmentId: firstAssessmentId }));

        // La estatura no se registró en el segundo borrador -- debe verse como "no registrada", no fabricada.
        expect(heightCard.draft).toBeNull();
        // Pero su valor histórico completado sigue disponible como referencia.
        expect(heightCard.latestCompleted).toEqual(expect.objectContaining({ value: 165, assessmentId: firstAssessmentId }));
    });

    it('15. completa la segunda evaluación', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/${secondAssessmentId}/complete`)
            .set('Authorization', `Bearer ${token}`)
            .expect(201);
        expect(res.body.status).toBe('COMPLETED');
    });

    it('16-17. el historial de peso trae ambos valores completados, ordenados desde el más reciente', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/measurements/m_weight/history`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.data.length).toBe(2);
        expect(res.body.data[0]).toEqual(expect.objectContaining({ value: 70, assessmentId: secondAssessmentId }));
        expect(res.body.data[1]).toEqual(expect.objectContaining({ value: 72.4, assessmentId: firstAssessmentId }));
        expect(new Date(res.body.data[0].date).getTime()).toBeGreaterThan(new Date(res.body.data[1].date).getTime());
        expect(res.body.meta).toEqual(expect.objectContaining({ total: 2 }));
    });

    it('con una 3ra evaluación completada, measurement-summary solo usa las 2 más recientes (nunca la 3ra) -- prueba real de la ventana SQL', async () => {
        const thirdDraft = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-09-01' })
            .expect(201);
        const thirdAssessmentId = thirdDraft.body.id;

        await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${thirdAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 68 }] })
            .expect(200);

        await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/${thirdAssessmentId}/complete`)
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        const summary = await request(app.getHttpServer())
            .get(`/patients/${patientId}/measurement-summary`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        const weightCard = summary.body.cards.find((c: any) => c.definitionId === 'm_weight');
        expect(weightCard.latestCompleted).toEqual(expect.objectContaining({ value: 68, assessmentId: thirdAssessmentId }));
        // previousCompleted debe ser la 2da más reciente (70, de secondAssessmentId) -- nunca la
        // 3ra más antigua (72.4, de firstAssessmentId), aunque esa siga existiendo en la base.
        expect(weightCard.previousCompleted).toEqual(expect.objectContaining({ value: 70, assessmentId: secondAssessmentId }));
        expect(weightCard.change).toEqual(expect.objectContaining({ difference: -2, trend: 'DOWN' }));

        const history = await request(app.getHttpServer())
            .get(`/patients/${patientId}/measurements/m_weight/history`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(history.body.meta.total).toBe(3);
        expect(history.body.data.map((d: any) => d.value)).toEqual([68, 70, 72.4]);
    });

    it('dos POST .../complete simultáneos sobre el mismo DRAFT: exactamente uno gana (201) y el otro pierde (409), sin duplicar resultados', async () => {
        const raceDraft = await request(app.getHttpServer())
            .post(`/patients/${concurrencyPatientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-08-01' })
            .expect(201);
        const raceAssessmentId = raceDraft.body.id;

        await request(app.getHttpServer())
            .patch(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 80 }, { definitionId: 'm_height', numericValue: 180 }] })
            .expect(200);

        const [res1, res2] = await Promise.all([
            request(app.getHttpServer()).post(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/complete`).set('Authorization', `Bearer ${token}`),
            request(app.getHttpServer()).post(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/complete`).set('Authorization', `Bearer ${token}`),
        ]);

        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([201, 409]);

        const final = await request(app.getHttpServer())
            .get(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(final.body.status).toBe('COMPLETED');
        const bmiResults = final.body.results.filter((r: any) => r.metricId === 'BMI');
        expect(bmiResults.length).toBe(1);
    });

    it('una request de upsert que pierde la carrera contra un complete concurrente recibe 409, no escribe sobre la evaluación ya completada', async () => {
        const raceDraft = await request(app.getHttpServer())
            .post(`/patients/${concurrencyPatientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-08-15' })
            .expect(201);
        const raceAssessmentId = raceDraft.body.id;

        await request(app.getHttpServer())
            .patch(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 80 }, { definitionId: 'm_height', numericValue: 180 }] })
            .expect(200);

        const [completeRes, upsertRes] = await Promise.all([
            request(app.getHttpServer()).post(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/complete`).set('Authorization', `Bearer ${token}`),
            request(app.getHttpServer()).patch(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}/measurements`).set('Authorization', `Bearer ${token}`).send({ measurements: [{ definitionId: 'm_weight', numericValue: 999 }] }),
        ]);

        // El orden real (quién toma el lock FOR UPDATE primero) no es determinista, pero el
        // invariante sí lo es: complete() siempre termina completando exactamente una vez, y el
        // upsert nunca "gana" silenciosamente contra una evaluación ya completada -- o corrió
        // antes (200, mientras seguía DRAFT) o fue rechazado (409), nunca queda en un estado raro.
        expect(completeRes.status).toBe(201);
        expect([200, 409]).toContain(upsertRes.status);

        const final = await request(app.getHttpServer())
            .get(`/patients/${concurrencyPatientId}/assessments/${raceAssessmentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(final.body.status).toBe('COMPLETED');

        if (upsertRes.status === 200) {
            // El upsert corrió antes de completar -- el motor debió haber usado el peso actualizado.
            const weightResult = final.body.measurements.find((m: any) => m.definitionId === 'm_weight');
            expect(weightResult.numericValue).toBe(999);
        }
    });

    describe('fechas clínicas sin desplazamiento por zona horaria', () => {
        let tzPatientId: string;

        beforeAll(async () => {
            const res = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'TZ', lastName: 'Patient', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            tzPatientId = res.body.id;
        });

        it('el DRAFT devuelve exactamente el mismo string YYYY-MM-DD que se envió, sin importar la TZ del proceso backend', async () => {
            const res = await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments/draft`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-07-26' })
                .expect(201);

            expect(res.body.date).toBe('2026-07-26');

            // Solo puede existir un DRAFT activo por paciente -- se completa para no bloquear
            // con su fecha la creación del siguiente DRAFT en el test que sigue.
            await request(app.getHttpServer())
                .patch(`/patients/${tzPatientId}/assessments/${res.body.id}/measurements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ measurements: [{ definitionId: 'm_weight', numericValue: 61 }] })
                .expect(200);
            await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments/${res.body.id}/complete`)
                .set('Authorization', `Bearer ${token}`)
                .expect(201);
        });

        it('completar no altera la fecha clínica, mientras que completedAt sí es un timestamp ISO completo', async () => {
            const draft = await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments/draft`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-31' })
                .expect(201);

            await request(app.getHttpServer())
                .patch(`/patients/${tzPatientId}/assessments/${draft.body.id}/measurements`)
                .set('Authorization', `Bearer ${token}`)
                .send({ measurements: [{ definitionId: 'm_weight', numericValue: 60 }] })
                .expect(200);

            const completed = await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments/${draft.body.id}/complete`)
                .set('Authorization', `Bearer ${token}`)
                .expect(201);

            expect(completed.body.date).toBe('2026-01-31');
            expect(completed.body.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it.each(['2026-13-01', '2026-02-30', '26-07-2026'])('rechaza "%s" como fecha de DRAFT con 400', async (badDate) => {
            await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments/draft`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: badDate })
                .expect(400);
        });

        it('el endpoint legado acepta tanto YYYY-MM-DD como ISO completo, normalizando ambos al mismo día calendario', async () => {
            const resShort = await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-05-10', measurements: [{ definitionId: 'm_weight', numericValue: 65 }] })
                .expect(201);
            expect(resShort.body.date).toBe('2026-05-10');

            const resIso = await request(app.getHttpServer())
                .post(`/patients/${tzPatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-05-11T23:30:00.000Z', measurements: [{ definitionId: 'm_weight', numericValue: 66 }] })
                .expect(201);
            expect(resIso.body.date).toBe('2026-05-11');
        });

        it('orden determinista: tres evaluaciones con la MISMA fecha clínica pero completedAt distintos se ordenan por completedAt, no por azar', async () => {
            const sameDate = '2026-04-01';
            const values = [10, 20, 30];
            const completedIds: string[] = [];

            for (const value of values) {
                const draft = await request(app.getHttpServer())
                    .post(`/patients/${tzPatientId}/assessments/draft`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ date: sameDate })
                    .expect(201);
                await request(app.getHttpServer())
                    .patch(`/patients/${tzPatientId}/assessments/${draft.body.id}/measurements`)
                    .set('Authorization', `Bearer ${token}`)
                    .send({ measurements: [{ definitionId: 'm_waist', numericValue: value }] })
                    .expect(200);
                const completed = await request(app.getHttpServer())
                    .post(`/patients/${tzPatientId}/assessments/${draft.body.id}/complete`)
                    .set('Authorization', `Bearer ${token}`)
                    .expect(201);
                completedIds.push(completed.body.id);
                // completedAt tiene precisión de milisegundo -- sin esta pausa real, dos
                // completados consecutivos podrían caer en el mismo milisegundo y el orden
                // dejaría de ser determinista por esa columna.
                await new Promise((resolve) => setTimeout(resolve, 20));
            }

            const summary = await request(app.getHttpServer())
                .get(`/patients/${tzPatientId}/measurement-summary`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            const waistCard = summary.body.cards.find((c: any) => c.definitionId === 'm_waist');
            expect(waistCard.latestCompleted).toEqual(expect.objectContaining({ value: 30, assessmentId: completedIds[2] }));
            expect(waistCard.previousCompleted).toEqual(expect.objectContaining({ value: 20, assessmentId: completedIds[1] }));

            const page1 = await request(app.getHttpServer())
                .get(`/patients/${tzPatientId}/measurements/m_waist/history?page=1&pageSize=2`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            const page2 = await request(app.getHttpServer())
                .get(`/patients/${tzPatientId}/measurements/m_waist/history?page=2&pageSize=2`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);

            expect(page1.body.data.map((d: any) => d.value)).toEqual([30, 20]);
            expect(page2.body.data.map((d: any) => d.value)).toEqual([10]);
            expect(page1.body.meta).toEqual(expect.objectContaining({ total: 3, totalPages: 2 }));
        });
    });
});
