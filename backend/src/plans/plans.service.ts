import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatClinicalDate } from '../common/clinical-date.util';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MacroMethod, RecalculatePlanDto } from './dto/recalculate-plan.dto';
import { AssessmentSnapshot, FinalizationReadiness, PlanCalculationService } from './plan-calculation.service';
import { ACTIVITY_LEVEL_TO_PAL, DEFAULT_BMR_STRATEGY_ID, DEFAULT_FIBER_SOURCE_ID, DEFAULT_WATER_SOURCE_ID } from '../calculation-engine/defaults';
import { StrategyResult } from '../calculation-engine/interfaces/calculation-strategy.interface';

const ENGINE_VERSION = 'v1.0.0';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PlansService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly planCalculation: PlanCalculationService,
    ) {}

    private async verifyPatientOwnership(client: PrismaClientOrTx, userId: string, patientId: string) {
        const patient = await client.patient.findFirst({ where: { id: patientId, userId } });
        if (!patient) throw new NotFoundException('Patient not found');
        return patient;
    }

    private async loadCompletedAssessment(client: PrismaClientOrTx, patientId: string, assessmentId: string) {
        const assessment = await client.assessment.findFirst({
            where: { id: assessmentId, patientId },
            include: { measurements: true },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'COMPLETED') {
            throw new BadRequestException('Assessment must be COMPLETED to be used for planning');
        }
        return assessment;
    }

    private buildSnapshot(
        assessment: Prisma.AssessmentGetPayload<{ include: { measurements: true } }>,
        patient: { sex: string; activityLevel: string },
    ): AssessmentSnapshot {
        const measurementValues: Record<string, number | string> = {};
        for (const m of assessment.measurements) {
            if (m.numericValue != null) measurementValues[m.definitionId] = m.numericValue;
            else if (m.stringValue) measurementValues[m.definitionId] = m.stringValue;
        }
        return {
            assessmentId: assessment.id,
            date: formatClinicalDate(assessment.date),
            populationGroup: (assessment.populationGroup ?? 'ADULT') as AssessmentSnapshot['populationGroup'],
            sex: patient.sex as 'MALE' | 'FEMALE',
            ageYears: assessment.ageAtAssessmentMonths != null ? Math.floor(assessment.ageAtAssessmentMonths / 12) : 0,
            activityLevel: patient.activityLevel,
            measurementValues,
        };
    }

    /** Non-clinical starting point for an editable plan objective -- the nutritionist changes any of this via recalculate. */
    private defaultPlanInputs(patient: { activityLevel: string }, snapshot: AssessmentSnapshot): RecalculatePlanDto {
        return {
            bmrFormulaId: DEFAULT_BMR_STRATEGY_ID,
            pal: ACTIVITY_LEVEL_TO_PAL[patient.activityLevel] ?? 1.2,
            targetWeightKg: snapshot.measurementValues['m_weight'] as number | undefined,
            macroMethod: MacroMethod.PERCENT,
            macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
            fiberSourceId: DEFAULT_FIBER_SOURCE_ID,
            waterSourceId: DEFAULT_WATER_SOURCE_ID,
        };
    }

    /**
     * Takes a row-level PostgreSQL lock (SELECT ... FOR UPDATE) on the NutritionalPlan for the
     * duration of the enclosing transaction, combining ownership validation in one atomic step --
     * same pattern as AssessmentsService.lockDraftAssessment. Callers decide which status they
     * require (recalculate/finalize need DRAFT, reopen needs FINALIZED), since unlike Assessment
     * a Plan has two legitimate target states depending on the operation.
     */
    private async lockPlanRow(tx: Prisma.TransactionClient, userId: string, patientId: string, planId: string) {
        const rows = await tx.$queryRaw<{ id: string; status: string; assessmentId: string }[]>`
            SELECT p.id, p.status, p."assessmentId"
            FROM "NutritionalPlan" p
            JOIN "Patient" pt ON pt.id = p."patientId"
            WHERE p.id = ${planId} AND p."patientId" = ${patientId} AND pt."userId" = ${userId}
            FOR UPDATE OF p
        `;
        const plan = rows[0];
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    /**
     * Pure reshape of an already-persisted plan row into the canonical API contract -- no DB
     * reads, no recomputation of clinical results (those only change via recalculate/finalize).
     * `canFinalize`/`finalizationBlockers` ARE recomputed fresh on every call (cheap, pure JS),
     * so they're never a stale cached value even on a plain GET.
     */
    private mapToDto(plan: any) {
        const snapshot = plan.sourceSnapshot as AssessmentSnapshot;
        const config = (plan.config ?? {}) as Partial<RecalculatePlanDto>;
        const results = (plan.calculationResults ?? {}) as Record<string, StrategyResult>;
        const readiness: FinalizationReadiness = this.planCalculation.evaluateFinalizationReadiness(snapshot, config, results);

        const macro = (metricId: string) => {
            const r = results[metricId];
            return {
                percentage: r?.metadataAsJson?.percent ?? null,
                grams: r?.numericValue ?? null,
                gramsPerKg: r?.metadataAsJson?.gPerKg ?? null,
                status: r?.status ?? 'MISSING_DATA',
            };
        };

        const resultDto = (metricId: string, unit?: string) => {
            const r = results[metricId];
            if (!r) return null;
            const strategy = this.planCalculation.describeCatalogChoice(r.formulaUsed);
            return {
                numericValue: r.numericValue ?? null,
                stringValue: r.stringValue ?? null,
                unit: unit ?? r.unit ?? null,
                status: r.status,
                statusCode: r.statusCode ?? null,
                formulaUsed: r.formulaUsed,
                formulaVersion: r.formulaVersion,
                reference: strategy?.reference ?? null,
                engineVersion: r.engineVersion,
            };
        };

        return {
            id: plan.id,
            patientId: plan.patientId,
            assessmentId: plan.assessmentId,
            status: plan.status,
            assessment: { date: snapshot.date, populationGroup: snapshot.populationGroup },
            sourceValues: {
                weightKg: snapshot.measurementValues['m_weight'] ?? null,
                heightCm: snapshot.measurementValues['m_height'] ?? null,
                ageYears: snapshot.ageYears,
                sex: snapshot.sex,
                activityLevel: snapshot.activityLevel,
            },
            config,
            results: {
                currentBmi: resultDto('CURRENT_BMI'),
                targetBmi: resultDto('TARGET_BMI'),
                weightDifferenceKg: resultDto('WEIGHT_DIFFERENCE_KG'),
                bmrKcal: resultDto('BMR', 'kcal/día'),
                tdeeKcal: resultDto('TDEE', 'kcal/día'),
                macros: {
                    protein: macro('PROTEIN_G'),
                    lipids: macro('FAT_G'),
                    carbohydrates: macro('CARBS_G'),
                },
                fiber: resultDto('FIBER_G'),
                water: resultDto('WATER_ML'),
            },
            canFinalize: readiness.canFinalize,
            finalizationBlockers: readiness.finalizationBlockers,
            calculationMetadata: {
                engineVersion: plan.engineVersion,
                bmrFormula: this.planCalculation.describeCatalogChoice(config.bmrFormulaId),
                fiberSource: this.planCalculation.describeCatalogChoice(config.fiberSourceId),
                waterSource: this.planCalculation.describeCatalogChoice(config.waterSourceId),
            },
            createdAt: plan.createdAt,
            updatedAt: plan.updatedAt,
            finalizedAt: plan.finalizedAt,
        };
    }

    // GET /patients/:patientId/plans
    async findAll(userId: string, patientId: string) {
        await this.verifyPatientOwnership(this.prisma, userId, patientId);
        return this.prisma.nutritionalPlan.findMany({
            where: { patientId, userId },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                status: true,
                date: true,
                finalizedAt: true,
                assessmentId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    // GET /patients/:patientId/plans/:id
    async findOne(userId: string, patientId: string, planId: string) {
        const plan = await this.prisma.nutritionalPlan.findFirst({ where: { id: planId, patientId, userId } });
        if (!plan) throw new NotFoundException('Plan not found');
        return this.mapToDto(plan);
    }

    // POST /patients/:patientId/plans  ->  crea o devuelve borrador activo, ligado a un Assessment COMPLETED
    async createOrGetDraft(userId: string, patientId: string, dto: CreatePlanDto) {
        const patient = await this.verifyPatientOwnership(this.prisma, userId, patientId);

        const existing = await this.prisma.nutritionalPlan.findFirst({ where: { patientId, userId, status: 'DRAFT' } });
        if (existing) {
            if (existing.assessmentId !== dto.assessmentId) {
                throw new ConflictException('Ya existe un plan en borrador para otra evaluación; complétalo o descártalo antes de crear uno nuevo.');
            }
            return this.mapToDto(existing);
        }

        const assessment = await this.loadCompletedAssessment(this.prisma, patientId, dto.assessmentId);
        if ((assessment.populationGroup ?? 'ADULT') !== 'ADULT') {
            throw new BadRequestException('Planificación solo está disponible para Adulto General en este momento.');
        }
        const snapshot = this.buildSnapshot(assessment, patient);
        const config = this.defaultPlanInputs(patient, snapshot);
        const calculationResults = this.planCalculation.calculate(snapshot, config);

        try {
            const created = await this.prisma.nutritionalPlan.create({
                data: {
                    patientId,
                    userId,
                    assessmentId: assessment.id,
                    date: new Date(),
                    sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    config: config as unknown as Prisma.InputJsonValue,
                    engineVersion: ENGINE_VERSION,
                },
            });
            return this.mapToDto(created);
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                // Another concurrent request already created the DRAFT (DB partial-unique-index race).
                const winner = await this.prisma.nutritionalPlan.findFirstOrThrow({ where: { patientId, userId, status: 'DRAFT' } });
                if (winner.assessmentId !== dto.assessmentId) {
                    throw new ConflictException('Ya existe un plan en borrador para otra evaluación; complétalo o descártalo antes de crear uno nuevo.');
                }
                return this.mapToDto(winner);
            }
            throw e;
        }
    }

    // POST /patients/:patientId/plans/:id/recalculate -- the only path that mutates clinical results
    async recalculate(userId: string, patientId: string, planId: string, dto: RecalculatePlanDto) {
        return this.prisma.$transaction(async (tx) => {
            const row = await this.lockPlanRow(tx, userId, patientId, planId);
            if (row.status !== 'DRAFT') {
                throw new ConflictException('Plan is not a DRAFT (already finalized). Reopen it first.');
            }

            const patient = await this.verifyPatientOwnership(tx, userId, patientId);
            const assessment = await this.loadCompletedAssessment(tx, patientId, row.assessmentId);
            const snapshot = this.buildSnapshot(assessment, patient);
            const calculationResults = this.planCalculation.calculate(snapshot, dto);

            const updated = await tx.nutritionalPlan.update({
                where: { id: planId },
                data: {
                    sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    config: dto as unknown as Prisma.InputJsonValue,
                    engineVersion: ENGINE_VERSION,
                },
            });
            return this.mapToDto(updated);
        });
    }

    // POST /patients/:patientId/plans/:id/finalize
    async finalize(userId: string, patientId: string, planId: string) {
        return this.prisma.$transaction(async (tx) => {
            const row = await this.lockPlanRow(tx, userId, patientId, planId);
            if (row.status !== 'DRAFT') {
                throw new ConflictException('Plan is not a DRAFT (already finalized by another request).');
            }

            const patient = await this.verifyPatientOwnership(tx, userId, patientId);
            const assessment = await this.loadCompletedAssessment(tx, patientId, row.assessmentId);
            const snapshot = this.buildSnapshot(assessment, patient);

            const current = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: planId } });
            const config = (current.config ?? {}) as unknown as RecalculatePlanDto;
            const calculationResults = this.planCalculation.calculate(snapshot, config);
            const readiness = this.planCalculation.evaluateFinalizationReadiness(snapshot, config, calculationResults);

            if (!readiness.canFinalize) {
                throw new BadRequestException({
                    message: 'No se puede finalizar: hay datos faltantes o inválidos.',
                    finalizationBlockers: readiness.finalizationBlockers,
                });
            }

            // Defensive belt-and-suspenders: the FOR UPDATE lock already guarantees this can't
            // affect 0 rows in practice, but the conditional WHERE + count check makes the
            // invariant explicit and gives a concrete 409 path if that assumption is ever broken
            // by a future refactor (same pattern as AssessmentsService.complete()).
            const updateResult = await tx.nutritionalPlan.updateMany({
                where: { id: planId, status: 'DRAFT' },
                data: {
                    status: 'FINALIZED',
                    finalizedAt: new Date(),
                    sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    config: config as unknown as Prisma.InputJsonValue,
                    engineVersion: ENGINE_VERSION,
                },
            });
            if (updateResult.count === 0) {
                throw new ConflictException('Plan was already finalized by another request.');
            }

            const final = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: planId } });
            return this.mapToDto(final);
        });
    }

    // POST /patients/:patientId/plans/:id/reopen
    async reopen(userId: string, patientId: string, planId: string) {
        return this.prisma.$transaction(async (tx) => {
            const row = await this.lockPlanRow(tx, userId, patientId, planId);
            if (row.status !== 'FINALIZED') {
                throw new ConflictException('Plan is not FINALIZED (already a draft).');
            }
            try {
                const updated = await tx.nutritionalPlan.update({
                    where: { id: planId },
                    data: { status: 'DRAFT', finalizedAt: null },
                });
                return this.mapToDto(updated);
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    // Another DRAFT already exists for this patient (DB partial-unique-index).
                    throw new ConflictException('There is already an active draft for this patient. Finalize it before reopening another plan.');
                }
                throw e;
            }
        });
    }
}
