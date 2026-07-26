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
    measurementValues: Record<string, number | string>;
}

const MACRO_METRICS: { key: 'PROTEIN' | 'CARBS' | 'FAT'; metricId: string }[] = [
    { key: 'PROTEIN', metricId: 'PROTEIN_G' },
    { key: 'CARBS', metricId: 'CARBS_G' },
    { key: 'FAT', metricId: 'FAT_G' },
];

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

        // BMI / body fat: pure facts about the snapshot, recomputed identically regardless of plan inputs.
        for (const metricId of ['BMI', 'BODY_FAT_PERCENTAGE']) {
            for (const strategy of this.registry.getForMetric(metricId, 'PLAN', population)) {
                results[metricId] = strategy.calculate(base, this.ENGINE_VERSION);
            }
        }
        // BMI is ASSESSMENT-only today; fall back to reusing the ASSESSMENT-phase strategy for plan display.
        if (!results['BMI']) {
            for (const strategy of this.registry.getForMetric('BMI', 'ASSESSMENT', population)) {
                results['BMI'] = strategy.calculate(base, this.ENGINE_VERSION);
            }
        }

        const bmrStrategy = this.registry.getById(planInputs.bmrFormulaId);
        if (!bmrStrategy.meta.phase.includes('PLAN') || !bmrStrategy.meta.population.includes(population)) {
            throw new BadRequestException(`La fórmula ${planInputs.bmrFormulaId} no está disponible para este contexto`);
        }
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
}
