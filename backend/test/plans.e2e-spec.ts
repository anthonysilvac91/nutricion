import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Plans (e2e)', () => {
    let app: INestApplication;
    let token: string;
    let secondToken: string;
    let patientId: string;
    let secondPatientId: string;
    let assessmentId: string;
    let planId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();

        const resAuth = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: `e2e-plans-${Date.now()}@test.com`, password: 'password123' })
            .expect(201);
        token = resAuth.body.access_token;

        const resPatient = await request(app.getHttpServer())
            .post('/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({
                firstName: 'Plan',
                lastName: 'Patient',
                sex: 'FEMALE',
                birthDate: '1994-01-01T00:00:00.000Z',
                activityLevel: 'MODERATE',
            })
            .expect(201);
        patientId = resPatient.body.id;

        const resSecondAuth = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: `e2e-plans-other-${Date.now()}@test.com`, password: 'password123' })
            .expect(201);
        secondToken = resSecondAuth.body.access_token;

        const resSecondPatient = await request(app.getHttpServer())
            .post('/patients')
            .set('Authorization', `Bearer ${secondToken}`)
            .send({
                firstName: 'Other',
                lastName: 'Patient',
                sex: 'MALE',
                birthDate: '1990-01-01T00:00:00.000Z',
                activityLevel: 'ACTIVE',
            })
            .expect(201);
        secondPatientId = resSecondPatient.body.id;
    });

    afterAll(async () => {
        await app.close();
    });

    it('creates a COMPLETED assessment with weight and height', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                date: '2026-01-01T00:00:00.000Z',
                measurements: [
                    { definitionId: 'm_weight', numericValue: 65 },
                    { definitionId: 'm_height', numericValue: 165 },
                ],
            })
            .expect(201);
        assessmentId = res.body.id;

        const bmr = res.body.results.find((r: any) => r.metricId === 'BMR');
        const tdee = res.body.results.find((r: any) => r.metricId === 'TDEE');
        expect(bmr.status).toBe('CALCULATED');
        expect(bmr.formulaUsed).toBe('BMR_HARRIS_BENEDICT_V1');
        expect(tdee.status).toBe('CALCULATED');
    });

    it('POST /patients/:id/plans - refuses to create a plan without a completed assessment', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId: 'does-not-exist' })
            .expect(404);
    });

    it('POST /patients/:id/plans - creates a DRAFT plan linked to the assessment', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId })
            .expect(201);

        expect(res.body.status).toBe('DRAFT');
        expect(res.body.assessmentId).toBe(assessmentId);
        expect(res.body.calculationResults.BMR.formulaUsed).toBe('BMR_HARRIS_BENEDICT_V1');
        planId = res.body.id;
    });

    it('POST /patients/:id/plans - does not create a plan for another user\'s patient', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${secondPatientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId })
            .expect(404);
    });

    it('GET /patients/:id/plans/:planId - is not reachable by another user', async () => {
        await request(app.getHttpServer())
            .get(`/patients/${patientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${secondToken}`)
            .expect(404);
    });

    it('GET /patients/:id/plans/:planId - is not reachable under a mismatched patientId even for the owning user', async () => {
        await request(app.getHttpServer())
            .get(`/patients/${secondPatientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(404);
    });

    let recalculatedTdee: number;

    it('POST /patients/:id/plans/:planId/recalculate - recomputes with nutritionist-chosen inputs', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/recalculate`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                bmrFormulaId: 'BMR_MIFFLIN_ST_JEOR_V1',
                pal: 1.725,
                targetWeightKg: 60,
                macroMethod: 'PERCENT',
                macroPercents: { PROTEIN: 20, CARBS: 50, FAT: 30 },
                fiberSourceId: 'FIBER_EFSA_V1',
                waterSourceId: 'WATER_MLKG_V1',
            })
            .expect(201);

        expect(res.body.calculationResults.BMR.formulaUsed).toBe('BMR_MIFFLIN_ST_JEOR_V1');
        expect(res.body.calculationResults.TDEE.metadataAsJson.palValue).toBe(1.725);
        expect(res.body.calculationResults.FIBER_G.formulaUsed).toBe('FIBER_EFSA_V1');
        expect(res.body.calculationResults.WATER_ML.formulaUsed).toBe('WATER_MLKG_V1');
        recalculatedTdee = res.body.calculationResults.TDEE.numericValue;
    });

    it('POST /patients/:id/plans/:planId/finalize - finalizes the plan', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/finalize`)
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        expect(res.body.status).toBe('FINALIZED');
        expect(res.body.finalizedAt).toBeDefined();
    });

    it('POST /patients/:id/plans/:planId/recalculate - refuses to edit a FINALIZED plan', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/recalculate`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                bmrFormulaId: 'BMR_OWEN_V1',
                pal: 1.2,
                macroMethod: 'PERCENT',
                macroPercents: { PROTEIN: 10, CARBS: 60, FAT: 30 },
                fiberSourceId: 'FIBER_IOM_V1',
                waterSourceId: 'WATER_IOM_V1',
            })
            .expect(400);
    });

    it('GET /patients/:id/plans/:planId - the finalized snapshot matches exactly the last recalculation, unchanged', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.status).toBe('FINALIZED');
        expect(res.body.calculationResults.BMR.formulaUsed).toBe('BMR_MIFFLIN_ST_JEOR_V1');
        expect(res.body.calculationResults.TDEE.numericValue).toBe(recalculatedTdee);
    });
});
