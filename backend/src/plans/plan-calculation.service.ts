import { BadRequestException, Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';
import { CalculationInputs, PopulationGroup, StrategyResult } from '../calculation-engine/interfaces/calculation-strategy.interface';
import { RecalculatePlanDto } from './dto/recalculate-plan.dto';

export interface AssessmentSnapshot {
    assessmentId: string;
    date: string;
    populationGroup: PopulationGroup;
    sex: 'MALE' | 'FEMALE';
    ageYears: number;
    activityLevel: string;
    measurementValues: Record<string, number | string>;
}

export interface FinalizationBlocker {
    code: string;
    field: string;
    message: string;
}

export interface FinalizationReadiness {
    canFinalize: boolean;
    finalizationBlockers: FinalizationBlocker[];
}

const MACRO_METRICS: { key: 'PROTEIN' | 'CARBS' | 'FAT'; metricId: string }[] = [
    { key: 'PROTEIN', metricId: 'PROTEIN_G' },
    { key: 'CARBS', metricId: 'CARBS_G' },
    { key: 'FAT', metricId: 'FAT_G' },
];

// Métricas que, si quedan en un status distinto de CALCULATED, bloquean la finalización
// (p. ej. Katch-McArdle elegido sin % de grasa medido → BMR y TDEE quedan en MISSING_DATA).
const REQUIRED_CALCULATED_METRICS = ['CURRENT_BMI', 'BMR', 'TDEE', 'PROTEIN_G', 'CARBS_G', 'FAT_G', 'FIBER_G', 'WATER_ML'];

@Injectable()
export class PlanCalculationService {
    private readonly ENGINE_VERSION = 'v1.0.0';

    constructor(private readonly registry: CalculationStrategyRegistry) { }

    calculate(snapshot: AssessmentSnapshot, planInputs: RecalculatePlanDto): Record<string, StrategyResult> {
        const population = snapshot.populationGroup;
        const targetWeightKg = planInputs.targetWeightKg ?? (snapshot.measurementValues['m_weight'] as number | undefined);

        const base: CalculationInputs = {
            // BMI/body-fat strategies read the weight from values['m_weight'] (same key used at
            // Assessment time) -- it must be substituted with the plan's target weight here too,
            // not just demographics.weightKg, or the "objetivo" BMI silently stays pinned to the
            // Assessment's actual weight.
            values: { ...snapshot.measurementValues, ...(targetWeightKg != null ? { m_weight: targetWeightKg } : {}) },
            demographics: {
                sex: snapshot.sex,
                ageYears: snapshot.ageYears,
                weightKg: targetWeightKg,
                heightCm: snapshot.measurementValues['m_height'] as number | undefined,
            },
            populationGroup: population,
        };

        const results: Record<string, StrategyResult> = {};

        // Body fat %: a pure fact about the snapshot, unaffected by plan inputs.
        for (const strategy of this.registry.getForMetric('BODY_FAT_PERCENTAGE', 'PLAN', population)) {
            results['BODY_FAT_PERCENTAGE'] = strategy.calculate(base, this.ENGINE_VERSION);
        }

        // BMI is ASSESSMENT-only today (no PLAN-phase registration) -- reuse the same strategy
        // (never duplicate the formula) twice: once with the real weight (CURRENT_BMI) and once
        // with the target weight already substituted into `base` (TARGET_BMI).
        const actualWeightKg = snapshot.measurementValues['m_weight'] as number | undefined;
        const bmiInputsActual: CalculationInputs = { ...base, values: { ...base.values, m_weight: actualWeightKg } };
        for (const strategy of this.registry.getForMetric('BMI', 'ASSESSMENT', population)) {
            results['CURRENT_BMI'] = strategy.calculate(bmiInputsActual, this.ENGINE_VERSION);
            results['TARGET_BMI'] = strategy.calculate(base, this.ENGINE_VERSION);
        }

        // Passthrough: a plain subtraction, not a "formula" with alternate sources/versions to
        // select -- no CalculationStrategy is registered for it, same style as TARGET_WEIGHT_KG below.
        results['WEIGHT_DIFFERENCE_KG'] = {
            metricId: 'WEIGHT_DIFFERENCE_KG',
            status: (targetWeightKg != null && actualWeightKg != null) ? ResultStatus.CALCULATED : ResultStatus.MISSING_DATA,
            numericValue: (targetWeightKg != null && actualWeightKg != null) ? parseFloat((targetWeightKg - actualWeightKg).toFixed(2)) : undefined,
            unit: 'kg',
            formulaUsed: 'WEIGHT_DIFFERENCE_SIMPLE_V1',
            formulaVersion: 'v1.0.0',
            engineVersion: this.ENGINE_VERSION,
        };

        if (!this.registry.isUsableForPlan(planInputs.bmrFormulaId, population)) {
            throw new BadRequestException(`La fórmula ${planInputs.bmrFormulaId} no está disponible para este contexto`);
        }
        const bmrStrategy = this.registry.getById(planInputs.bmrFormulaId);
        const bmrInputs: CalculationInputs = {
            ...base,
            values: { ...base.values, bodyFatPercent: snapshot.measurementValues['m_fat_percent'] },
        };
        const bmr = bmrStrategy.calculate(bmrInputs, this.ENGINE_VERSION);
        results['BMR'] = bmr;

        const tdeeInputs: CalculationInputs = {
            ...base,
            values: { ...base.values, bmrValue: bmr.numericValue, palValue: planInputs.pal },
        };
        const tdee = this.registry.getById('TDEE_BMR_PAL_V1').calculate(tdeeInputs, this.ENGINE_VERSION);
        results['TDEE'] = tdee;

        const getKcal = planInputs.targetKcalOverride ?? tdee.numericValue;
        for (const macro of MACRO_METRICS) {
            const strategyId = planInputs.macroMethod === 'GRAMS_PER_KG' && macro.key === 'PROTEIN'
                ? 'MACRO_PROTEIN_GRAMS_PER_KG_V1'
                : `MACRO_${macro.key}_GRAMS_FROM_PERCENT_V1`;
            const macroInputs: CalculationInputs = {
                ...base,
                values: {
                    ...base.values,
                    getKcal,
                    percent: planInputs.macroPercents?.[macro.key],
                    gPerKg: planInputs.macroGPerKg,
                    targetWeightKg,
                },
            };
            results[macro.metricId] = this.registry.getById(strategyId).calculate(macroInputs, this.ENGINE_VERSION);
        }

        if (!this.registry.isUsableForPlan(planInputs.fiberSourceId, population)) {
            throw new BadRequestException(`La fuente de fibra ${planInputs.fiberSourceId} no está disponible para este contexto`);
        }
        if (!this.registry.isUsableForPlan(planInputs.waterSourceId, population)) {
            throw new BadRequestException(`La fuente de agua ${planInputs.waterSourceId} no está disponible para este contexto`);
        }
        results['FIBER_G'] = this.registry.getById(planInputs.fiberSourceId).calculate(base, this.ENGINE_VERSION);
        results['WATER_ML'] = this.registry.getById(planInputs.waterSourceId).calculate(
            { ...base, values: { ...base.values, targetWeightKg } },
            this.ENGINE_VERSION,
        );

        // Passthrough of the raw plan inputs actually used, so the frontend can
        // rehydrate its form fields from calculationResults alone -- it must
        // never reconstruct/guess these values locally.
        results['TARGET_WEIGHT_KG'] = {
            metricId: 'TARGET_WEIGHT_KG',
            status: targetWeightKg != null ? ResultStatus.CALCULATED : ResultStatus.MISSING_DATA,
            numericValue: targetWeightKg,
            unit: 'kg',
            formulaUsed: 'PLAN_INPUT_PASSTHROUGH',
            formulaVersion: 'v1.0.0',
            engineVersion: this.ENGINE_VERSION,
        };
        if (planInputs.targetKcalOverride != null) {
            results['TARGET_KCAL_OVERRIDE'] = {
                metricId: 'TARGET_KCAL_OVERRIDE',
                status: ResultStatus.CALCULATED,
                numericValue: planInputs.targetKcalOverride,
                unit: 'kcal/day',
                formulaUsed: 'PLAN_INPUT_PASSTHROUGH',
                formulaVersion: 'v1.0.0',
                engineVersion: this.ENGINE_VERSION,
            };
        }

        return results;
    }

    /**
     * The backend's sole authority on whether a plan is finalizable -- the frontend only ever
     * displays `canFinalize`/`finalizationBlockers` verbatim, never re-derives them. Re-run on
     * every read (findOne/create/recalculate) and once more, freshly, inside finalize()'s
     * transaction -- never trusted as a stale persisted value.
     */
    evaluateFinalizationReadiness(
        snapshot: AssessmentSnapshot,
        config: Partial<RecalculatePlanDto> | null | undefined,
        results: Record<string, StrategyResult>,
    ): FinalizationReadiness {
        const blockers: FinalizationBlocker[] = [];
        const cfg = config ?? {};

        if (snapshot.measurementValues['m_weight'] == null) {
            blockers.push({ code: 'MISSING_WEIGHT', field: 'weightKg', message: 'La evaluación no contiene peso.' });
        }
        if (snapshot.measurementValues['m_height'] == null) {
            blockers.push({ code: 'MISSING_HEIGHT', field: 'heightCm', message: 'La evaluación no contiene estatura.' });
        }
        if (!snapshot.activityLevel) {
            blockers.push({ code: 'MISSING_ACTIVITY_LEVEL', field: 'activityLevel', message: 'El paciente no tiene un nivel de actividad definido.' });
        }
        if (!this.registry.isUsableForPlan(cfg.bmrFormulaId, snapshot.populationGroup)) {
            blockers.push({ code: 'MISSING_BMR_FORMULA', field: 'bmrFormulaId', message: 'No hay una fórmula de TMB válida seleccionada.' });
        }
        if (!this.registry.isUsableForPlan(cfg.fiberSourceId, snapshot.populationGroup)) {
            blockers.push({ code: 'MISSING_FIBER_SOURCE', field: 'fiberSourceId', message: 'No hay una fuente de fibra válida seleccionada.' });
        }
        if (!this.registry.isUsableForPlan(cfg.waterSourceId, snapshot.populationGroup)) {
            blockers.push({ code: 'MISSING_WATER_SOURCE', field: 'waterSourceId', message: 'No hay una fuente de agua válida seleccionada.' });
        }
        const macroSum = cfg.macroPercents
            ? (cfg.macroPercents.PROTEIN ?? 0) + (cfg.macroPercents.CARBS ?? 0) + (cfg.macroPercents.FAT ?? 0)
            : null;
        if (macroSum == null || Math.abs(macroSum - 100) > 0.01) {
            blockers.push({
                code: 'INVALID_MACRO_TOTAL',
                field: 'macroPercents',
                message: macroSum == null
                    ? 'No hay una distribución de macronutrientes definida.'
                    : `Los porcentajes de macronutrientes deben sumar 100% (actual: ${macroSum}%).`,
            });
        }
        for (const metricId of REQUIRED_CALCULATED_METRICS) {
            if (results[metricId]?.status !== ResultStatus.CALCULATED) {
                blockers.push({
                    code: 'METRIC_MISSING_DATA',
                    field: metricId,
                    message: `No se pudo calcular ${metricId} con los datos e insumos actuales.`,
                });
            }
        }

        return { canFinalize: blockers.length === 0, finalizationBlockers: blockers };
    }

    /** Static metadata (label/version/reference) for a selected catalog choice -- used to build calculationMetadata, never exposes the strategy's formula logic itself. */
    describeCatalogChoice(strategyId: string | undefined): { id: string; version: string; reference: string } | null {
        if (!strategyId) return null;
        const strategy = this.registry.byIdOrNull(strategyId);
        if (!strategy) return null;
        return { id: strategy.meta.id, version: strategy.meta.version, reference: strategy.meta.reference.citation };
    }
}
