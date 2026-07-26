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

    it('BMI reflects the plan target weight, not the assessment actual weight', () => {
        const actualBmi = service.calculate(baseSnapshot(), basePlanInputs({ targetWeightKg: 65 })).BMI.numericValue;
        const targetBmi = service.calculate(baseSnapshot(), basePlanInputs({ targetWeightKg: 60 })).BMI.numericValue;
        expect(targetBmi).not.toBe(actualBmi);
        expect(targetBmi).toBeCloseTo(60 / (1.65 * 1.65), 1);
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
});
