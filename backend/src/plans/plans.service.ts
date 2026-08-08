import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatClinicalDate } from '../common/clinical-date.util';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MacroMethod, RecalculatePlanDto } from './dto/recalculate-plan.dto';
import { AssessmentSnapshot, CalculationMetadata, FinalizationReadiness, PlanCalculationService } from './plan-calculation.service';
import { ACTIVITY_LEVEL_TO_PAL, DEFAULT_BMR_STRATEGY_ID, DEFAULT_FIBER_SOURCE_ID, DEFAULT_WATER_SOURCE_ID } from '../calculation-engine/defaults';
import { StrategyResult } from '../calculation-engine/interfaces/calculation-strategy.interface';

// No `private`/module-local: reutilizada tal cual por EncounterPlanService (corte 4) para que
// un plan creado desde el flujo encounter-scoped quede en la misma versión de motor que uno
// legacy, sin declarar una segunda constante que pudiera divergir.
export const ENGINE_VERSION = 'v1.0.0';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;
type CompletedAssessmentWithTrace = Prisma.AssessmentGetPayload<{
    include: { measurements: { include: { definition: true } }; results: true };
}>;

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

    /**
     * No `private`: reutilizado tal cual por EncounterPlanService (corte 4) para cargar,
     * bajo el mismo lock/transacción del caller, el Assessment exacto de un ClinicalEncounter
     * (nunca "el último COMPLETED del paciente") con la traza completa que buildSnapshotV2 necesita.
     */
    async loadCompletedAssessment(client: PrismaClientOrTx, patientId: string, assessmentId: string): Promise<CompletedAssessmentWithTrace> {
        const assessment = await client.assessment.findFirst({
            where: { id: assessmentId, patientId },
            include: { measurements: { include: { definition: true } }, results: true },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'COMPLETED') {
            throw new BadRequestException('Assessment must be COMPLETED to be used for planning');
        }
        return assessment;
    }

    /**
     * Builds the canonical v2 snapshot -- called exactly once, either when a DRAFT is first
     * created (createOrGetDraft) or, for a pre-v2 legacy DRAFT, the one time it's upgraded inside
     * ensureSnapshotV2. Never called again afterwards: recalculate()/finalize() read the
     * persisted snapshot instead of re-deriving it, which is the whole point of freezing it.
     * No `private`: reutilizado tal cual por EncounterPlanService (corte 4) -- única autoridad de
     * construcción de snapshot, sin duplicarla para el flujo encounter-scoped.
     */
    buildSnapshotV2(
        assessment: CompletedAssessmentWithTrace,
        patient: { sex: string; activityLevel: string },
    ): AssessmentSnapshot {
        const measurementValues: Record<string, number | string> = {};
        const measurements = assessment.measurements.map((m) => {
            if (m.numericValue != null) measurementValues[m.definitionId] = m.numericValue;
            else if (m.stringValue) measurementValues[m.definitionId] = m.stringValue;
            return {
                recordId: m.id,
                definitionId: m.definitionId,
                name: m.definition.name,
                unit: m.definition.unit,
                numericValue: m.numericValue,
                stringValue: m.stringValue,
            };
        });
        const assessmentResults = assessment.results.map((r) => ({
            metricId: r.metricId,
            numericValue: r.numericValue,
            stringValue: r.stringValue,
            status: r.status,
            formulaUsed: r.formulaUsed,
            formulaVersion: r.formulaVersion,
            engineVersion: r.engineVersion,
            statusCode: r.statusCode,
            statusLabel: r.statusLabel,
        }));

        return {
            snapshotVersion: 'v2',
            assessmentId: assessment.id,
            assessmentDate: formatClinicalDate(assessment.date),
            assessmentCompletedAt: assessment.completedAt ? assessment.completedAt.toISOString() : null,
            populationGroup: (assessment.populationGroup ?? 'ADULT') as AssessmentSnapshot['populationGroup'],
            ageAtAssessmentMonths: assessment.ageAtAssessmentMonths ?? null,
            sex: patient.sex as 'MALE' | 'FEMALE',
            ageYears: assessment.ageAtAssessmentMonths != null ? Math.floor(assessment.ageAtAssessmentMonths / 12) : 0,
            activityLevel: patient.activityLevel,
            measurementValues,
            measurements,
            assessmentResults,
        };
    }

    /**
     * DRAFTs created before `snapshotVersion` existed are missing the trace fields (measurements,
     * assessmentResults, assessmentDate, ...). Rather than leave them permanently un-upgradeable,
     * recalculate() calls this once, inside the same lock/transaction as the recalculation itself,
     * to rebuild and persist a v2 snapshot from the still-referenced Assessment -- the one and only
     * controlled exception to "never reconstruct sourceSnapshot from current Patient/Assessment
     * state". Already-v2 snapshots pass through untouched and are never rewritten.
     * No `private`: reutilizado tal cual por EncounterPlanService.recalculate() (corte 4) -- misma
     * autoridad de upgrade, nunca una segunda reimplementación.
     */
    async ensureSnapshotV2(
        tx: Prisma.TransactionClient,
        plan: { patientId: string; assessmentId: string; sourceSnapshot: unknown },
    ): Promise<{ snapshot: AssessmentSnapshot; upgraded: boolean }> {
        const raw = plan.sourceSnapshot as { snapshotVersion?: string } | null;
        if (raw?.snapshotVersion === 'v2') {
            return { snapshot: raw as unknown as AssessmentSnapshot, upgraded: false };
        }
        const patient = await tx.patient.findFirstOrThrow({ where: { id: plan.patientId } });
        const assessment = await this.loadCompletedAssessment(tx, plan.patientId, plan.assessmentId);
        return { snapshot: this.buildSnapshotV2(assessment, patient), upgraded: true };
    }

    /**
     * Non-clinical starting point for an editable plan objective -- the nutritionist changes any
     * of this via recalculate. No `private`: reutilizado tal cual por EncounterPlanService.createOrGet
     * (corte 4) para el cálculo inicial del plan encounter-scoped.
     */
    defaultPlanInputs(patient: { activityLevel: string }, snapshot: AssessmentSnapshot): RecalculatePlanDto {
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
     * same pattern as AssessmentsService.lockDraftAssessment. Both operations that use this
     * (recalculate/finalize) require the plan to be DRAFT; there is no operation that ever takes a
     * FINALIZED plan back to DRAFT, so unlike Assessment's lock helper this one has only one
     * legitimate target status.
     *
     * Corte 4: rechaza explícitamente un NutritionalPlan con encounterId no nulo. Las rutas legacy
     * (userId-scoped) nunca deben poder mutar un plan ligado a un ClinicalEncounter -- eso
     * permitiría saltarse la autorización por Workspace, el estado del Encounter y la
     * reconciliación de EncounterModuleState. Esas mutaciones solo pueden hacerse mediante las
     * rutas encounter-scoped (EncounterPlanService), que usan su propio lock.
     */
    private async lockPlanRow(tx: Prisma.TransactionClient, userId: string, patientId: string, planId: string) {
        const rows = await tx.$queryRaw<{ id: string; status: string; assessmentId: string; encounterId: string | null }[]>`
            SELECT p.id, p.status, p."assessmentId", p."encounterId"
            FROM "NutritionalPlan" p
            JOIN "Patient" pt ON pt.id = p."patientId"
            WHERE p.id = ${planId} AND p."patientId" = ${patientId} AND pt."userId" = ${userId}
            FOR UPDATE OF p
        `;
        const plan = rows[0];
        if (!plan) throw new NotFoundException('Plan not found');
        if (plan.encounterId) {
            throw new ConflictException({
                code: 'PLAN_LINKED_TO_ENCOUNTER',
                message: 'Este plan pertenece a una consulta clínica; usa las rutas de la consulta para modificarlo.',
            });
        }
        return plan;
    }

    /**
     * Pure reshape of an already-persisted plan row into the canonical API contract -- no DB
     * reads, no recomputation of clinical results (those only change via recalculate/finalize),
     * and no calls into the calculation-strategy registry: `reference`/`calculationMetadata` come
     * exclusively from `plan.calculationMetadata`, frozen at write time. `canFinalize`/
     * `finalizationBlockers` ARE recomputed fresh on every call (cheap, pure JS over the already-
     * persisted snapshot/config/results), so they're never a stale cached value even on a plain GET.
     * No `private`: mismo shape clínico/UI reutilizado por EncounterPlanService (corte 4) -- no
     * crear una segunda representación.
     */
    mapToDto(plan: any) {
        const snapshot = plan.sourceSnapshot as AssessmentSnapshot;
        const config = (plan.config ?? {}) as Partial<RecalculatePlanDto>;
        const results = (plan.calculationResults ?? {}) as Record<string, StrategyResult>;
        const metadata = (plan.calculationMetadata ?? null) as CalculationMetadata | null;
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
            return {
                numericValue: r.numericValue ?? null,
                stringValue: r.stringValue ?? null,
                unit: unit ?? r.unit ?? null,
                status: r.status,
                statusCode: r.statusCode ?? null,
                formulaUsed: r.formulaUsed,
                formulaVersion: r.formulaVersion,
                reference: metadata?.metrics?.[metricId]?.reference ?? null,
                engineVersion: r.engineVersion,
            };
        };

        // Legacy FINALIZED plans predating snapshotVersion never get rewritten (see
        // ensureSnapshotV2), so their persisted shape still uses the old `date` key -- fall back
        // to it here purely for display; nothing is derived or recomputed from it.
        const assessmentDate = snapshot?.assessmentDate ?? (snapshot as any)?.date ?? null;

        return {
            id: plan.id,
            patientId: plan.patientId,
            assessmentId: plan.assessmentId,
            status: plan.status,
            assessment: { date: assessmentDate, populationGroup: snapshot.populationGroup },
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
            // Legacy rows created before calculationMetadata existed return null here rather than
            // a live registry lookup -- never present dynamic/current references as if they were
            // the historical trace of what was actually used to calculate this plan.
            calculationMetadata: metadata
                ? {
                    engineVersion: metadata.engineVersion,
                    bmrFormula: metadata.selectedSources?.bmrFormula ?? null,
                    fiberSource: metadata.selectedSources?.fiberSource ?? null,
                    waterSource: metadata.selectedSources?.waterSource ?? null,
                }
                : null,
            calculatedAt: plan.calculatedAt ?? null,
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
            // Corte 4: el DRAFT activo del paciente pertenece a un ClinicalEncounter -- la ruta
            // legacy no debe devolverlo ni mucho menos permitir mutarlo por esta vía (ver
            // lockPlanRow). El caller debe usar las rutas encounter-scoped.
            if (existing.encounterId) {
                throw new ConflictException({
                    code: 'PLAN_LINKED_TO_ENCOUNTER',
                    message: 'El borrador activo de este paciente pertenece a una consulta clínica; usa las rutas de la consulta para acceder a él.',
                });
            }
            if (existing.assessmentId !== dto.assessmentId) {
                throw new ConflictException('Ya existe un plan en borrador para otra evaluación; complétalo o descártalo antes de crear uno nuevo.');
            }
            return this.mapToDto(existing);
        }

        const assessment = await this.loadCompletedAssessment(this.prisma, patientId, dto.assessmentId);
        if ((assessment.populationGroup ?? 'ADULT') !== 'ADULT') {
            throw new BadRequestException('Planificación solo está disponible para Adulto General en este momento.');
        }
        const snapshot = this.buildSnapshotV2(assessment, patient);
        const config = this.defaultPlanInputs(patient, snapshot);
        const calculationResults = this.planCalculation.calculate(snapshot, config);
        const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, config);

        try {
            const created = await this.prisma.nutritionalPlan.create({
                data: {
                    patientId,
                    userId,
                    assessmentId: assessment.id,
                    date: new Date(),
                    sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
                    calculatedAt: new Date(),
                    config: config as unknown as Prisma.InputJsonValue,
                    engineVersion: ENGINE_VERSION,
                },
            });
            return this.mapToDto(created);
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                // Another concurrent request already created the DRAFT (DB partial-unique-index race).
                // El ganador puede haber sido una POST .../encounters/:encounterId/plan concurrente
                // -- si quedó ligado a un ClinicalEncounter, esta ruta legacy NUNCA debe devolverlo
                // (ni su lectura), igual que ya rechaza el caso no-concurrente de arriba (`existing.encounterId`).
                const winner = await this.prisma.nutritionalPlan.findFirstOrThrow({ where: { patientId, userId, status: 'DRAFT' } });
                if (winner.encounterId) {
                    throw new ConflictException({
                        code: 'PLAN_LINKED_TO_ENCOUNTER',
                        message: 'El borrador activo de este paciente pertenece a una consulta clínica; usa las rutas de la consulta para acceder a él.',
                    });
                }
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
                throw new ConflictException('Plan is not a DRAFT (already finalized); a finalized plan is permanently immutable.');
            }

            const current = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: planId } });
            const { snapshot, upgraded } = await this.ensureSnapshotV2(tx, current);

            const calculationResults = this.planCalculation.calculate(snapshot, dto);
            const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, dto);

            const updated = await tx.nutritionalPlan.update({
                where: { id: planId },
                data: {
                    // Only written when this recalculate is the one-time legacy upgrade -- an
                    // already-v2 snapshot is never re-persisted, even with identical content.
                    ...(upgraded ? { sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue } : {}),
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
                    calculatedAt: new Date(),
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

            // Exclusively the persisted snapshot/config -- no Patient/Assessment re-fetch. A plan
            // reaching finalize() has always been recalculated at least once (the frontend always
            // calls recalculate before finalize), so by this point sourceSnapshot is already v2;
            // finalize never performs the legacy-upgrade rewrite itself, and never touches
            // sourceSnapshot in its own update.
            const current = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: planId } });
            const snapshot = current.sourceSnapshot as unknown as AssessmentSnapshot;
            const config = (current.config ?? {}) as unknown as RecalculatePlanDto;

            const calculationResults = this.planCalculation.calculate(snapshot, config);
            const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, config);
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
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
                    calculatedAt: new Date(),
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
}
