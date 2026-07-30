import { BadRequestException } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import { PlanCalculationService, AssessmentSnapshot } from './plan-calculation.service';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';
import { BmiAdultV1Strategy } from '../calculation-engine/strategies/adult/bmi-adult-v1.strategy';
import { BodyFatMeasuredV1Strategy } from '../calculation-engine/strategies/adult/body-fat-measured-v1.strategy';
import { TdeeBmrPalV1Strategy } from '../calculation-engine/strategies/adult/tdee-bmr-pal-v1.strategy';
import { BmrHarrisBenedictV1Strategy } from '../calculation-engine/strategies/adult/bmr/bmr-harris-benedict-v1.strategy';
import { BmrKatchMcArdleV1Strategy } from '../calculation-engine/strategies/adult/bmr/bmr-katch-mcardle-v1.strategy';
import { MacroProteinGramsFromPercentV1Strategy } from '../calculation-engine/strategies/adult/macros/macro-protein-grams-from-percent-v1.strategy';
import { MacroCarbsGramsFromPercentV1Strategy } from '../calculation-engine/strategies/adult/macros/macro-carbs-grams-from-percent-v1.strategy';
import { MacroFatGramsFromPercentV1Strategy } from '../calculation-engine/strategies/adult/macros/macro-fat-grams-from-percent-v1.strategy';
import { MacroProteinGramsPerKgV1Strategy } from '../calculation-engine/strategies/adult/macros/macro-protein-grams-per-kg-v1.strategy';
import { FiberIomV1Strategy } from '../calculation-engine/strategies/adult/fiber/fiber-iom-v1.strategy';
import { WaterIomV1Strategy } from '../calculation-engine/strategies/adult/water/water-iom-v1.strategy';
import { MacroMethod, RecalculatePlanDto } from './dto/recalculate-plan.dto';

function buildRegistry(): CalculationStrategyRegistry {
    const registry = new CalculationStrategyRegistry([
        new BmiAdultV1Strategy(),
        new BodyFatMeasuredV1Strategy(),
        new TdeeBmrPalV1Strategy(),
        new BmrHarrisBenedictV1Strategy(),
        new BmrKatchMcArdleV1Strategy(),
        new MacroProteinGramsFromPercentV1Strategy(),
        new MacroCarbsGramsFromPercentV1Strategy(),
        new MacroFatGramsFromPercentV1Strategy(),
        new MacroProteinGramsPerKgV1Strategy(),
        new FiberIomV1Strategy(),
        new WaterIomV1Strategy(),
    ]);
    registry.onModuleInit();
    return registry;
}

function baseSnapshot(overrides: Partial<AssessmentSnapshot> = {}): AssessmentSnapshot {
    return {
        assessmentId: 'assessment-1',
        date: '2026-01-01',
        populationGroup: 'ADULT',
        sex: 'FEMALE',
        ageYears: 32,
        activityLevel: 'MODERATE',
        measurementValues: { m_weight: 65, m_height: 165 },
        ...overrides,
    };
}

function basePlanInputs(overrides: Partial<RecalculatePlanDto> = {}): RecalculatePlanDto {
    return {
        bmrFormulaId: 'BMR_HARRIS_BENEDICT_V1',
        pal: 1.55,
        macroMethod: MacroMethod.PERCENT,
        macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
        fiberSourceId: 'FIBER_IOM_V1',
        waterSourceId: 'WATER_IOM_V1',
        ...overrides,
    } as RecalculatePlanDto;
}

describe('PlanCalculationService', () => {
    let service: PlanCalculationService;

    beforeEach(() => {
        service = new PlanCalculationService(buildRegistry());
    });

    it('composes BMR -> TDEE -> macros using the nutritionist-chosen formula/PAL', () => {
        const results = service.calculate(baseSnapshot(), basePlanInputs());

        expect(results.BMR.status).toBe(ResultStatus.CALCULATED);
        expect(results.BMR.formulaUsed).toBe('BMR_HARRIS_BENEDICT_V1');
        expect(results.TDEE.status).toBe(ResultStatus.CALCULATED);
        expect(results.TDEE.numericValue).toBe(Math.round((results.BMR.numericValue ?? 0) * 1.55));

        expect(results.PROTEIN_G.numericValue).toBe(Math.round(((results.TDEE.numericValue ?? 0) * 0.15) / 4));
        expect(results.CARBS_G.numericValue).toBe(Math.round(((results.TDEE.numericValue ?? 0) * 0.55) / 4));
        expect(results.FAT_G.numericValue).toBe(Math.round(((results.TDEE.numericValue ?? 0) * 0.30) / 9));

        expect(results.FIBER_G.status).toBe(ResultStatus.CALCULATED);
        expect(results.WATER_ML.status).toBe(ResultStatus.CALCULATED);

        // Every metric must carry formula/version/engine metadata (product requirement).
        for (const result of Object.values(results)) {
            expect(result.formulaUsed).toBeTruthy();
            expect(result.formulaVersion).toBe('v1.0.0');
            expect(result.engineVersion).toBe('v1.0.0');
        }
    });

    it('CURRENT_BMI always reflects the real weight; TARGET_BMI reflects the plan target weight', () => {
        const results = service.calculate(baseSnapshot(), basePlanInputs({ targetWeightKg: 60 }));
        expect(results.CURRENT_BMI.numericValue).toBeCloseTo(65 / (1.65 * 1.65), 1);
        expect(results.TARGET_BMI.numericValue).toBeCloseTo(60 / (1.65 * 1.65), 1);
        expect(results.TARGET_BMI.numericValue).not.toBe(results.CURRENT_BMI.numericValue);
        // Same underlying strategy/formula reused for both -- no duplicate formula.
        expect(results.CURRENT_BMI.formulaUsed).toBe('BMI_ADULT_V1');
        expect(results.TARGET_BMI.formulaUsed).toBe('BMI_ADULT_V1');
    });

    it('WEIGHT_DIFFERENCE_KG is the plain target-minus-actual delta, MISSING_DATA when either is absent', () => {
        const results = service.calculate(baseSnapshot(), basePlanInputs({ targetWeightKg: 60 }));
        expect(results.WEIGHT_DIFFERENCE_KG.status).toBe(ResultStatus.CALCULATED);
        expect(results.WEIGHT_DIFFERENCE_KG.numericValue).toBeCloseTo(-5, 2);

        const noWeight = service.calculate(baseSnapshot({ measurementValues: { m_height: 165 } }), basePlanInputs({ targetWeightKg: 60 }));
        expect(noWeight.WEIGHT_DIFFERENCE_KG.status).toBe(ResultStatus.MISSING_DATA);
    });

    it('respects targetKcalOverride instead of the computed TDEE for macro grams', () => {
        const results = service.calculate(baseSnapshot(), basePlanInputs({ targetKcalOverride: 1800 }));
        expect(results.PROTEIN_G.numericValue).toBe(Math.round((1800 * 0.15) / 4));
    });

    it('uses GRAMS_PER_KG method for protein when selected', () => {
        const results = service.calculate(
            baseSnapshot(),
            basePlanInputs({ macroMethod: MacroMethod.GRAMS_PER_KG, macroGPerKg: 1.6, targetWeightKg: 60 }),
        );
        expect(results.PROTEIN_G.formulaUsed).toBe('MACRO_PROTEIN_GRAMS_PER_KG_V1');
        expect(results.PROTEIN_G.numericValue).toBe(Math.round(1.6 * 60));
    });

    it('switches BMR formula to Katch-McArdle and reflects MISSING_DATA when no fat% was measured', () => {
        const results = service.calculate(baseSnapshot(), basePlanInputs({ bmrFormulaId: 'BMR_KATCH_MCARDLE_V1' }));
        expect(results.BMR.status).toBe(ResultStatus.MISSING_DATA);
        // Downstream TDEE must also reflect the missing BMR rather than silently computing with a bogus value.
        expect(results.TDEE.status).toBe(ResultStatus.MISSING_DATA);
    });

    it('throws when an unknown or out-of-phase formula id is requested', () => {
        expect(() => service.calculate(baseSnapshot(), basePlanInputs({ bmrFormulaId: 'BMI_ADULT_V1' }))).toThrow();
    });

    it.each([1.55, 1.2, 1.375, 1.725, 1.9])('accepts the catalog PAL value %p', (pal) => {
        expect(() => service.calculate(baseSnapshot(), basePlanInputs({ pal }))).not.toThrow();
    });

    it.each([0, -1, 1.3, 2, 10, NaN, Infinity])('rejects an out-of-catalog PAL (%p) with BadRequestException -- defense in depth behind the DTO validator', (pal) => {
        expect(() => service.calculate(baseSnapshot(), basePlanInputs({ pal }))).toThrow(BadRequestException);
    });

    describe('evaluateFinalizationReadiness', () => {
        it('canFinalize is true when the snapshot, config and results are all complete/valid', () => {
            const snapshot = baseSnapshot();
            const config = basePlanInputs();
            const results = service.calculate(snapshot, config);
            const readiness = service.evaluateFinalizationReadiness(snapshot, config, results);
            expect(readiness).toEqual({ canFinalize: true, finalizationBlockers: [] });
        });

        it('flags MISSING_WEIGHT and MISSING_HEIGHT when the assessment lacks them', () => {
            const snapshot = baseSnapshot({ measurementValues: {} });
            const config = basePlanInputs();
            const results = service.calculate(snapshot, config);
            const readiness = service.evaluateFinalizationReadiness(snapshot, config, results);
            expect(readiness.canFinalize).toBe(false);
            const codes = readiness.finalizationBlockers.map(b => b.code);
            expect(codes).toContain('MISSING_WEIGHT');
            expect(codes).toContain('MISSING_HEIGHT');
        });

        it('flags INVALID_MACRO_TOTAL when the percentages do not sum to 100', () => {
            const snapshot = baseSnapshot();
            const config = basePlanInputs({ macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 20 } });
            const results = service.calculate(snapshot, config);
            const readiness = service.evaluateFinalizationReadiness(snapshot, config, results);
            expect(readiness.canFinalize).toBe(false);
            expect(readiness.finalizationBlockers.map(b => b.code)).toContain('INVALID_MACRO_TOTAL');
        });

        it('flags METRIC_MISSING_DATA when a chosen formula cannot compute (Katch-McArdle without body fat %)', () => {
            const snapshot = baseSnapshot();
            const config = basePlanInputs({ bmrFormulaId: 'BMR_KATCH_MCARDLE_V1' });
            const results = service.calculate(snapshot, config);
            const readiness = service.evaluateFinalizationReadiness(snapshot, config, results);
            expect(readiness.canFinalize).toBe(false);
            expect(readiness.finalizationBlockers.map(b => b.code)).toContain('METRIC_MISSING_DATA');
        });

        it('flags MISSING_BMR_FORMULA/MISSING_FIBER_SOURCE/MISSING_WATER_SOURCE when config is empty', () => {
            const snapshot = baseSnapshot();
            const readiness = service.evaluateFinalizationReadiness(snapshot, {}, {});
            expect(readiness.canFinalize).toBe(false);
            const codes = readiness.finalizationBlockers.map(b => b.code);
            expect(codes).toContain('MISSING_BMR_FORMULA');
            expect(codes).toContain('MISSING_FIBER_SOURCE');
            expect(codes).toContain('MISSING_WATER_SOURCE');
        });
    });

    describe('describeCatalogChoice', () => {
        it('returns id/version/reference for a known strategy id', () => {
            const described = service.describeCatalogChoice('BMR_HARRIS_BENEDICT_V1');
            expect(described).toEqual(expect.objectContaining({ id: 'BMR_HARRIS_BENEDICT_V1', version: 'v1.0.0' }));
            expect(described?.reference).toBeTruthy();
        });

        it('returns null for an unknown id instead of throwing', () => {
            expect(service.describeCatalogChoice('NOT_A_REAL_ID')).toBeNull();
            expect(service.describeCatalogChoice(undefined)).toBeNull();
        });
    });

    describe('buildCalculationMetadata', () => {
        it('freezes formula/version/reference per traced metric plus the selected sources', () => {
            const snapshot = baseSnapshot();
            const config = basePlanInputs();
            const results = service.calculate(snapshot, config);

            const metadata = service.buildCalculationMetadata(results, config);

            expect(metadata.metadataVersion).toBe('v1');
            expect(metadata.engineVersion).toBe('v1.0.0');
            expect(metadata.metrics.BMR).toEqual(expect.objectContaining({ formulaId: 'BMR_HARRIS_BENEDICT_V1', formulaVersion: 'v1.0.0' }));
            expect(metadata.metrics.BMR.reference).toBeTruthy();
            expect(metadata.selectedSources.bmrFormula).toEqual(expect.objectContaining({ id: 'BMR_HARRIS_BENEDICT_V1' }));
            expect(metadata.selectedSources.fiberSource).toEqual(expect.objectContaining({ id: 'FIBER_IOM_V1' }));
            expect(metadata.selectedSources.waterSource).toEqual(expect.objectContaining({ id: 'WATER_IOM_V1' }));
        });

        it('a metric missing from results still gets a metrics entry, with nulls rather than a thrown error', () => {
            const metadata = service.buildCalculationMetadata({}, {});
            expect(metadata.metrics.BMR).toEqual({ formulaId: null, formulaVersion: null, reference: null, unit: null });
            expect(metadata.selectedSources.bmrFormula).toBeNull();
        });
    });
});
