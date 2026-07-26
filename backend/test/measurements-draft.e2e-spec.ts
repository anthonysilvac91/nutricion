import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Measurements DRAFT lifecycle (e2e)', () => {
    let app: INestApplication;
    let token: string;
    let patientId: string;
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

        // 2. Crear paciente adulto
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
    });

    afterAll(async () => {
        await app.close();
    });

    it('3. crea un Assessment DRAFT', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-06-15T00:00:00.000Z' })
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

    it('no permite editar ni eliminar mediciones de una evaluación COMPLETED', async () => {
        await request(app.getHttpServer())
            .patch(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements`)
            .set('Authorization', `Bearer ${token}`)
            .send({ measurements: [{ definitionId: 'm_weight', numericValue: 99 }] })
            .expect(400);

        await request(app.getHttpServer())
            .delete(`/patients/${patientId}/assessments/${firstAssessmentId}/measurements/m_weight`)
            .set('Authorization', `Bearer ${token}`)
            .expect(400);
    });

    it('11-12. crea un segundo DRAFT y registra un peso nuevo', async () => {
        const resDraft = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments/draft`)
            .set('Authorization', `Bearer ${token}`)
            .send({ date: '2026-07-26T00:00:00.000Z' })
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
});
