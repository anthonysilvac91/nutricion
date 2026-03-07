import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Assessments (e2e)', () => {
    let app: INestApplication;
    let token: string;
    let patientId: string;
    let assessmentId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        // 1. Create a test user to get a token
        const uniqueEmail = `e2e-${Date.now()}@test.com`;
        const resAuth = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: uniqueEmail, password: 'password123' })
            .expect(201);

        token = resAuth.body.access_token;

        // 2. Create a test patient
        const resPatient = await request(app.getHttpServer())
            .post('/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({
                firstName: 'Integration',
                lastName: 'Test',
                sex: 'MALE',
                birthDate: '1990-01-01T00:00:00.000Z',
                activityLevel: 'MODERATE'
            })
            .expect(201);

        patientId = resPatient.body.id;
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /patients/:id/assessments - creates assessment and calculates BMI', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                date: '2026-03-01T10:00:00.000Z',
                status: 'COMPLETED',
                measurements: [
                    { definitionId: 'm_weight', numericValue: 80 },
                    { definitionId: 'm_height', numericValue: 180 }
                ]
            })
            .expect(201);

        expect(res.body.status).toBe('COMPLETED');
        expect(res.body.measurements).toBeDefined();
        expect(res.body.measurements.length).toBe(2);

        expect(res.body.results).toBeDefined();
        const bmiResult = res.body.results.find((r: any) => r.metricId === 'BMI');
        expect(bmiResult).toBeDefined();
        expect(bmiResult.numericValue).toBeCloseTo(24.69, 1);
        expect(bmiResult.statusCode).toBe('NORMAL');
        expect(bmiResult.status).toBe('CALCULATED');

        assessmentId = res.body.id;
    });

    it('POST /patients/:id/assessments - handles missing data and not applicable cases', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                date: '2026-03-02T10:00:00.000Z',
                status: 'COMPLETED',
                measurements: [
                    { definitionId: 'm_weight', numericValue: 80 } // missing height
                ]
            })
            .expect(201);

        const bmiResult = res.body.results.find((r: any) => r.metricId === 'BMI');
        expect(bmiResult).toBeDefined();
        expect(bmiResult.status).toBe('MISSING_DATA');
    });

    it('GET /patients/:id/assessments/latest - returns latest assessment details', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/assessments/latest`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.status).toBe('COMPLETED');
        // Note: It should return the one from 2026-03-02 as it's the latest
        expect(res.body.date).toBe('2026-03-02T10:00:00.000Z');
    });

    it('GET /patients/:id/summary - returns proper summary', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/summary`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.patientId).toBe(patientId);
        expect(res.body.demographics).toBeDefined();
        expect(res.body.demographics.sex).toBe('MALE');
        expect(res.body.latestVitals).toBeDefined();
        expect(res.body.latestVitals.weight.value).toBe(80);
        // Since the latest assessment (March 2nd) has MISSING_DATA for BMI, the summary might not include BMI or return undefined for it.
        // The previous code did `const bmiResult = latestAssessment.results.find(...)` which is the latest one.
    });

    it('GET /patients/:id/planning-context - returns planning context', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/planning-context`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.patientId).toBe(patientId);
        expect(res.body.resolvedProfile.ageGroup).toBe('ADULT');
        expect(res.body.availableData).toBeDefined();
    });
});
