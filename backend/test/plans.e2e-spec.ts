import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Plans (e2e)', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let token: string;
    let secondToken: string;
    let patientId: string;
    let secondPatientId: string;
    let assessmentId: string;
    let secondAssessmentId: string;
    let planId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        prisma = moduleFixture.get(PrismaService);

        // 1. Registrar nutricionista
        const resAuth = await request(app.getHttpServer())
            .post('/auth/register')
            .send({ email: `e2e-plans-${Date.now()}@test.com`, password: 'password123' })
            .expect(201);
        token = resAuth.body.access_token;

        // 2. Crear paciente adulto
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

        // Evaluación COMPLETED de un segundo paciente, usada para los tests de aislamiento por assessmentId.
        const resSecondAssessment = await request(app.getHttpServer())
            .post(`/patients/${secondPatientId}/assessments`)
            .set('Authorization', `Bearer ${secondToken}`)
            .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 80 }, { definitionId: 'm_height', numericValue: 180 }] })
            .expect(201);
        secondAssessmentId = resSecondAssessment.body.id;
    });

    afterAll(async () => {
        await app.close();
    });

    it('3-5. crea y completa una evaluación con peso y estatura', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/assessments`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                date: '2026-01-01',
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

    it('6. lista evaluaciones COMPLETED, elegibles para Planificación', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/assessments?status=COMPLETED`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(res.body.map((a: any) => a.id)).toContain(assessmentId);
        expect(res.body.find((a: any) => a.id === assessmentId).date).toBe('2026-01-01');
    });

    it('POST /patients/:id/plans - refuses to create a plan without a completed assessment', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId: 'does-not-exist' })
            .expect(404);
    });

    it('POST /patients/:id/plans - refuses an assessment that belongs to a different patient (404, not leaked)', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId: secondAssessmentId })
            .expect(404);
    });

    it('7. POST /patients/:id/plans - creates a DRAFT plan linked to the assessment', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans`)
            .set('Authorization', `Bearer ${token}`)
            .send({ assessmentId })
            .expect(201);

        expect(res.body.status).toBe('DRAFT');
        expect(res.body.assessmentId).toBe(assessmentId);
        expect(res.body.assessment).toEqual({ date: '2026-01-01', populationGroup: 'ADULT' });
        expect(res.body.sourceValues).toEqual(expect.objectContaining({ weightKg: 65, heightCm: 165, sex: 'FEMALE', activityLevel: 'MODERATE' }));
        expect(res.body.config).toEqual(expect.objectContaining({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1' }));
        expect(res.body.results.bmrKcal.formulaUsed).toBe('BMR_HARRIS_BENEDICT_V1');
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

    it('8. GET /patients/:id/planning-context - devuelve el contexto clínico canónico', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/planning-context?assessmentId=${assessmentId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(res.body.date).toBe('2026-01-01');
        expect(res.body.weightKg).toBe(65);
        expect(res.body.heightCm).toBe(165);
        expect(res.body.availableFormulas.bmr.length).toBeGreaterThan(0);
    });

    it('el recalculate rechaza campos no declarados (bmi/canFinalize) por whitelist/forbidNonWhitelisted', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/recalculate`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
                pal: 1.55,
                macroMethod: 'PERCENT',
                macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
                fiberSourceId: 'FIBER_IOM_V1',
                waterSourceId: 'WATER_IOM_V1',
                bmi: 99, // no declarado en el DTO -- debe ser rechazado
                canFinalize: true, // idem
            })
            .expect(400);
    });

    let recalculatedTdee: number;

    it('9-13. POST recalculate - recomputes with nutritionist-chosen inputs (fórmula, PAL, peso objetivo, macros 20/50/30, fibra/agua)', async () => {
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

        expect(res.body.results.bmrKcal.formulaUsed).toBe('BMR_MIFFLIN_ST_JEOR_V1');
        expect(res.body.results.tdeeKcal.status).toBe('CALCULATED');
        expect(res.body.results.fiber.formulaUsed).toBe('FIBER_EFSA_V1');
        expect(res.body.results.water.formulaUsed).toBe('WATER_MLKG_V1');
        expect(res.body.results.macros.protein.percentage).toBe(20);
        expect(res.body.results.macros.lipids.percentage).toBe(30);
        expect(res.body.results.macros.carbohydrates.percentage).toBe(50);
        expect(res.body.results.macros.protein.grams).toBeGreaterThan(0);
        expect(res.body.results.macros.protein.gramsPerKg).toBeGreaterThan(0);
        expect(res.body.results.currentBmi.numericValue).toBeCloseTo(65 / (1.65 * 1.65), 1);
        expect(res.body.results.targetBmi.numericValue).toBeCloseTo(60 / (1.65 * 1.65), 1);
        expect(res.body.results.weightDifferenceKg.numericValue).toBeCloseTo(-5, 1);
        expect(res.body.calculationMetadata.bmrFormula).toEqual(expect.objectContaining({ id: 'BMR_MIFFLIN_ST_JEOR_V1' }));
        recalculatedTdee = res.body.results.tdeeKcal.numericValue;
    });

    it('14. canFinalize es true con datos completos y macros sumando 100', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);
        expect(res.body.canFinalize).toBe(true);
        expect(res.body.finalizationBlockers).toEqual([]);
    });

    it('15. POST finalize - finalizes the plan', async () => {
        const res = await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/finalize`)
            .set('Authorization', `Bearer ${token}`)
            .expect(201);

        expect(res.body.status).toBe('FINALIZED');
        expect(res.body.finalizedAt).toBeDefined();
    });

    it('19-20. intentar modificar/recalcular un plan FINALIZED devuelve 409, no 400', async () => {
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
            .expect(409);
    });

    it('21. intentar finalizar de nuevo devuelve 409 y no duplica información', async () => {
        await request(app.getHttpServer())
            .post(`/patients/${patientId}/plans/${planId}/finalize`)
            .set('Authorization', `Bearer ${token}`)
            .expect(409);
    });

    it('22. GET - el snapshot y metadata finalizados no cambian tras los intentos rechazados', async () => {
        const res = await request(app.getHttpServer())
            .get(`/patients/${patientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200);

        expect(res.body.status).toBe('FINALIZED');
        expect(res.body.results.bmrKcal.formulaUsed).toBe('BMR_MIFFLIN_ST_JEOR_V1');
        expect(res.body.results.tdeeKcal.numericValue).toBe(recalculatedTdee);
        expect(res.body.calculationMetadata.engineVersion).toBe('v1.0.0');
    });

    it('23. otro usuario no puede acceder al plan finalizado', async () => {
        await request(app.getHttpServer())
            .get(`/patients/${patientId}/plans/${planId}`)
            .set('Authorization', `Bearer ${secondToken}`)
            .expect(404);
    });

    describe('datos incompletos: solo peso, sin estatura', () => {
        let incompletePatientId: string;
        let incompleteAssessmentId: string;
        let incompletePlanId: string;

        it('crea una evaluación solo con peso y un plan sobre ella', async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Incomplete', lastName: 'Data', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            incompletePatientId = resPatient.body.id;

            const resAssessment = await request(app.getHttpServer())
                .post(`/patients/${incompletePatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 70 }] })
                .expect(201);
            incompleteAssessmentId = resAssessment.body.id;

            const resPlan = await request(app.getHttpServer())
                .post(`/patients/${incompletePatientId}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: incompleteAssessmentId })
                .expect(201);
            incompletePlanId = resPlan.body.id;
        });

        it('recalcular funciona (no rechaza), pero canFinalize es false con blocker MISSING_HEIGHT', async () => {
            const res = await request(app.getHttpServer())
                .post(`/patients/${incompletePatientId}/plans/${incompletePlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
                    pal: 1.55,
                    macroMethod: 'PERCENT',
                    macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
                    fiberSourceId: 'FIBER_IOM_V1',
                    waterSourceId: 'WATER_IOM_V1',
                })
                .expect(201);

            expect(res.body.canFinalize).toBe(false);
            expect(res.body.finalizationBlockers.map((b: any) => b.code)).toContain('MISSING_HEIGHT');
        });

        it('finalize es rechazado (400) con la lista de finalizationBlockers', async () => {
            const res = await request(app.getHttpServer())
                .post(`/patients/${incompletePatientId}/plans/${incompletePlanId}/finalize`)
                .set('Authorization', `Bearer ${token}`)
                .expect(400);
            expect(res.body.finalizationBlockers.map((b: any) => b.code)).toContain('MISSING_HEIGHT');
        });
    });

    describe('macros que no suman 100', () => {
        let macroPatientId: string;
        let macroAssessmentId: string;
        let macroPlanId: string;

        it('crea evaluación y plan completos', async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Macro', lastName: 'Invalid', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            macroPatientId = resPatient.body.id;

            const resAssessment = await request(app.getHttpServer())
                .post(`/patients/${macroPatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 170 }] })
                .expect(201);
            macroAssessmentId = resAssessment.body.id;

            const resPlan = await request(app.getHttpServer())
                .post(`/patients/${macroPatientId}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: macroAssessmentId })
                .expect(201);
            macroPlanId = resPlan.body.id;
        });

        it('recalculate con macros sumando 97% no lo rechaza (sigue calculando), pero bloquea la finalización', async () => {
            const res = await request(app.getHttpServer())
                .post(`/patients/${macroPatientId}/plans/${macroPlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
                    pal: 1.55,
                    macroMethod: 'PERCENT',
                    macroPercents: { PROTEIN: 15, CARBS: 52, FAT: 30 },
                    fiberSourceId: 'FIBER_IOM_V1',
                    waterSourceId: 'WATER_IOM_V1',
                })
                .expect(201);

            expect(res.body.results.macros.protein.grams).toBeGreaterThan(0);
            expect(res.body.canFinalize).toBe(false);
            expect(res.body.finalizationBlockers.map((b: any) => b.code)).toContain('INVALID_MACRO_TOTAL');

            await request(app.getHttpServer())
                .post(`/patients/${macroPatientId}/plans/${macroPlanId}/finalize`)
                .set('Authorization', `Bearer ${token}`)
                .expect(400);
        });
    });

    describe('concurrencia: doble finalize simultáneo', () => {
        let concurrencyPatientId: string;
        let concurrencyPlanId: string;

        beforeAll(async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Concurrency', lastName: 'Plan', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            concurrencyPatientId = resPatient.body.id;

            const resAssessment = await request(app.getHttpServer())
                .post(`/patients/${concurrencyPatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 170 }] })
                .expect(201);

            const resPlan = await request(app.getHttpServer())
                .post(`/patients/${concurrencyPatientId}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: resAssessment.body.id })
                .expect(201);
            concurrencyPlanId = resPlan.body.id;
        });

        it('dos POST finalize simultáneos: exactamente uno gana (201) y el otro pierde (409), sin duplicar resultados', async () => {
            const [res1, res2] = await Promise.all([
                request(app.getHttpServer()).post(`/patients/${concurrencyPatientId}/plans/${concurrencyPlanId}/finalize`).set('Authorization', `Bearer ${token}`),
                request(app.getHttpServer()).post(`/patients/${concurrencyPatientId}/plans/${concurrencyPlanId}/finalize`).set('Authorization', `Bearer ${token}`),
            ]);

            const statuses = [res1.status, res2.status].sort();
            expect(statuses).toEqual([201, 409]);

            const final = await request(app.getHttpServer())
                .get(`/patients/${concurrencyPatientId}/plans/${concurrencyPlanId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            expect(final.body.status).toBe('FINALIZED');
        });

        it('una request de recalculate que pierde la carrera contra un finalize concurrente recibe 409, nunca escribe sobre el plan ya finalizado', async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Concurrency2', lastName: 'Plan', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            const raceAssessment = await request(app.getHttpServer())
                .post(`/patients/${resPatient.body.id}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 170 }] })
                .expect(201);
            const racePlan = await request(app.getHttpServer())
                .post(`/patients/${resPatient.body.id}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: raceAssessment.body.id })
                .expect(201);

            const recalcBody = {
                bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55, macroMethod: 'PERCENT',
                macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 }, fiberSourceId: 'FIBER_IOM_V1', waterSourceId: 'WATER_IOM_V1',
            };
            const [finalizeRes, recalcRes] = await Promise.all([
                request(app.getHttpServer()).post(`/patients/${resPatient.body.id}/plans/${racePlan.body.id}/finalize`).set('Authorization', `Bearer ${token}`),
                request(app.getHttpServer()).post(`/patients/${resPatient.body.id}/plans/${racePlan.body.id}/recalculate`).set('Authorization', `Bearer ${token}`).send(recalcBody),
            ]);

            // El orden real (quién toma el lock FOR UPDATE primero) no es determinista, pero el
            // invariante sí: finalize siempre termina finalizando exactamente una vez, y recalculate
            // nunca "gana" silenciosamente contra un plan ya finalizado -- o corrió antes (201,
            // mientras seguía DRAFT) o fue rechazado (409).
            expect(finalizeRes.status).toBe(201);
            expect([201, 409]).toContain(recalcRes.status);

            const final = await request(app.getHttpServer())
                .get(`/patients/${resPatient.body.id}/plans/${racePlan.body.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            expect(final.body.status).toBe('FINALIZED');
        });
    });

    describe('inmutabilidad total: snapshot congelado, metadata congelada, sin reopen', () => {
        let immutablePatientId: string;
        let immutableAssessmentId: string;
        let immutablePlanId: string;
        let initialSourceSnapshot: unknown;

        it('1-5. crea paciente, Assessment COMPLETED y plan DRAFT; guarda el sourceSnapshot inicial', async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Immutable', lastName: 'Snapshot', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            immutablePatientId = resPatient.body.id;

            const resAssessment = await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 65 }, { definitionId: 'm_height', numericValue: 165 }] })
                .expect(201);
            immutableAssessmentId = resAssessment.body.id;

            const resPlan = await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: immutableAssessmentId })
                .expect(201);
            immutablePlanId = resPlan.body.id;
            expect(resPlan.body.sourceValues).toEqual(expect.objectContaining({ sex: 'FEMALE', activityLevel: 'MODERATE' }));

            const row = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: immutablePlanId } });
            initialSourceSnapshot = row.sourceSnapshot;
            expect((initialSourceSnapshot as any).snapshotVersion).toBe('v2');
            expect(row.calculationMetadata).not.toBeNull();
            expect(row.calculatedAt).not.toBeNull();
        });

        it('6-9. cambiar sex/activityLevel del Patient y recalcular no altera el plan ya vinculado -- sourceSnapshot sigue congelado', async () => {
            await request(app.getHttpServer())
                .patch(`/patients/${immutablePatientId}`)
                .set('Authorization', `Bearer ${token}`)
                .send({ sex: 'MALE', activityLevel: 'VERY_ACTIVE' })
                .expect(200);

            const res = await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans/${immutablePlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55, macroMethod: 'PERCENT',
                    macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 }, fiberSourceId: 'FIBER_IOM_V1', waterSourceId: 'WATER_IOM_V1',
                })
                .expect(201);

            // El plan sigue reflejando sex/activityLevel congelados al crear el DRAFT, no los
            // valores actuales del Patient (que ahora son MALE/VERY_ACTIVE).
            expect(res.body.sourceValues).toEqual(expect.objectContaining({ sex: 'FEMALE', activityLevel: 'MODERATE' }));

            const row = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: immutablePlanId } });
            expect(row.sourceSnapshot).toEqual(initialSourceSnapshot);
        });

        it('10. calculationMetadata queda persistido tras recalcular, con las fuentes seleccionadas', async () => {
            const row = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: immutablePlanId } });
            const metadata = row.calculationMetadata as any;
            expect(metadata).not.toBeNull();
            expect(row.calculatedAt).not.toBeNull();
            expect(metadata.selectedSources.bmrFormula.id).toBe('BMR_HARRIS_BENEDICT_V1');
            expect(metadata.metrics.BMR.formulaId).toBe('BMR_HARRIS_BENEDICT_V1');
        });

        it('11-12. finaliza el plan', async () => {
            const res = await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans/${immutablePlanId}/finalize`)
                .set('Authorization', `Bearer ${token}`)
                .expect(201);
            expect(res.body.status).toBe('FINALIZED');
            expect(res.body.finalizedAt).toBeDefined();

            const row = await prisma.nutritionalPlan.findUniqueOrThrow({ where: { id: immutablePlanId } });
            expect(row.sourceSnapshot).toEqual(initialSourceSnapshot);
        });

        it('13. POST .../reopen ya no existe -- la ruta devuelve 404', async () => {
            await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans/${immutablePlanId}/reopen`)
                .set('Authorization', `Bearer ${token}`)
                .expect(404);
        });

        it('14. recalculate sobre un plan FINALIZED devuelve 409', async () => {
            await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans/${immutablePlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                    bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal: 1.55, macroMethod: 'PERCENT',
                    macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 }, fiberSourceId: 'FIBER_IOM_V1', waterSourceId: 'WATER_IOM_V1',
                })
                .expect(409);
        });

        it('15. finalize de nuevo devuelve 409, sin duplicar información', async () => {
            await request(app.getHttpServer())
                .post(`/patients/${immutablePatientId}/plans/${immutablePlanId}/finalize`)
                .set('Authorization', `Bearer ${token}`)
                .expect(409);
        });

        it('16. GET sigue mostrando la misma referencia y metadata que al finalizar', async () => {
            const res = await request(app.getHttpServer())
                .get(`/patients/${immutablePatientId}/plans/${immutablePlanId}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200);
            expect(res.body.status).toBe('FINALIZED');
            expect(res.body.calculationMetadata.bmrFormula.id).toBe('BMR_HARRIS_BENEDICT_V1');
            expect(res.body.results.bmrKcal.reference).toBeTruthy();
        });

        it('17. otro usuario no puede acceder al plan (404, no se filtra su existencia)', async () => {
            await request(app.getHttpServer())
                .get(`/patients/${immutablePatientId}/plans/${immutablePlanId}`)
                .set('Authorization', `Bearer ${secondToken}`)
                .expect(404);
        });
    });

    describe('PAL solo acepta valores del catálogo', () => {
        let palPatientId: string;
        let palPlanId: string;

        beforeAll(async () => {
            const resPatient = await request(app.getHttpServer())
                .post('/patients')
                .set('Authorization', `Bearer ${token}`)
                .send({ firstName: 'Pal', lastName: 'Catalog', sex: 'FEMALE', birthDate: '1994-01-01T00:00:00.000Z', activityLevel: 'MODERATE' })
                .expect(201);
            palPatientId = resPatient.body.id;

            const resAssessment = await request(app.getHttpServer())
                .post(`/patients/${palPatientId}/assessments`)
                .set('Authorization', `Bearer ${token}`)
                .send({ date: '2026-01-01', measurements: [{ definitionId: 'm_weight', numericValue: 70 }, { definitionId: 'm_height', numericValue: 170 }] })
                .expect(201);

            const resPlan = await request(app.getHttpServer())
                .post(`/patients/${palPatientId}/plans`)
                .set('Authorization', `Bearer ${token}`)
                .send({ assessmentId: resAssessment.body.id })
                .expect(201);
            palPlanId = resPlan.body.id;
        });

        it.each([1.2, 1.375, 1.55, 1.725, 1.9])('acepta el PAL permitido %p', async (pal) => {
            await request(app.getHttpServer())
                .post(`/patients/${palPatientId}/plans/${palPlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal, macroMethod: 'PERCENT', macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 }, fiberSourceId: 'FIBER_IOM_V1', waterSourceId: 'WATER_IOM_V1' })
                .expect(201);
        });

        it.each([0, -1, 1.3, 2, 10])('rechaza un PAL fuera del catálogo (%p) con 400', async (pal) => {
            await request(app.getHttpServer())
                .post(`/patients/${palPatientId}/plans/${palPlanId}/recalculate`)
                .set('Authorization', `Bearer ${token}`)
                .send({ bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1', pal, macroMethod: 'PERCENT', macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 }, fiberSourceId: 'FIBER_IOM_V1', waterSourceId: 'WATER_IOM_V1' })
                .expect(400);
        });
    });
});
