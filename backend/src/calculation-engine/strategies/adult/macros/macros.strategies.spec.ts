import { ResultStatus } from '@prisma/client';
import { MacroProteinGramsFromPercentV1Strategy } from './macro-protein-grams-from-percent-v1.strategy';
import { MacroCarbsGramsFromPercentV1Strategy } from './macro-carbs-grams-from-percent-v1.strategy';
import { MacroFatGramsFromPercentV1Strategy } from './macro-fat-grams-from-percent-v1.strategy';
import { MacroProteinGramsPerKgV1Strategy } from './macro-protein-grams-per-kg-v1.strategy';
import { CalculationInputs } from '../../../interfaces/calculation-strategy.interface';

function inputs(values: CalculationInputs['values']): CalculationInputs {
    return { values, demographics: {}, populationGroup: 'ADULT' };
}

describe('Macro percent-based strategies', () => {
    it('protein: grams = getKcal * pct/100 / 4', () => {
        const strategy = new MacroProteinGramsFromPercentV1Strategy();
        const result = strategy.calculate(inputs({ getKcal: 2000, percent: 15 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(Math.round((2000 * 0.15) / 4));
    });

    it('carbs: grams = getKcal * pct/100 / 4', () => {
        const strategy = new MacroCarbsGramsFromPercentV1Strategy();
        const result = strategy.calculate(inputs({ getKcal: 2000, percent: 55 }), 'v1.0.0');
        expect(result.numericValue).toBe(Math.round((2000 * 0.55) / 4));
    });

    it('fat: grams = getKcal * pct/100 / 9', () => {
        const strategy = new MacroFatGramsFromPercentV1Strategy();
        const result = strategy.calculate(inputs({ getKcal: 2000, percent: 30 }), 'v1.0.0');
        expect(result.numericValue).toBe(Math.round((2000 * 0.3) / 9));
    });

    it('returns MISSING_DATA when getKcal or percent is absent', () => {
        const strategy = new MacroProteinGramsFromPercentV1Strategy();
        expect(strategy.calculate(inputs({ percent: 15 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
        expect(strategy.calculate(inputs({ getKcal: 2000 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns NOT_APPLICABLE for a percentage outside 0-100', () => {
        const strategy = new MacroProteinGramsFromPercentV1Strategy();
        expect(strategy.calculate(inputs({ getKcal: 2000, percent: 150 }), 'v1.0.0').status).toBe(ResultStatus.NOT_APPLICABLE);
    });

    it('includes g/kg in metadata when a target weight is provided (never computed client-side)', () => {
        const strategy = new MacroProteinGramsFromPercentV1Strategy();
        const result = strategy.calculate(inputs({ getKcal: 2000, percent: 15, targetWeightKg: 60 }), 'v1.0.0');
        const grams = Math.round((2000 * 0.15) / 4);
        expect(result.metadataAsJson?.gPerKg).toBeCloseTo(grams / 60, 2);
    });

    it('omits g/kg when no target weight is available', () => {
        const strategy = new MacroProteinGramsFromPercentV1Strategy();
        const result = strategy.calculate(inputs({ getKcal: 2000, percent: 15 }), 'v1.0.0');
        expect(result.metadataAsJson?.gPerKg).toBeUndefined();
    });
});

describe('MacroProteinGramsPerKgV1Strategy', () => {
    const strategy = new MacroProteinGramsPerKgV1Strategy();

    it('grams = gPerKg * targetWeightKg', () => {
        const result = strategy.calculate(inputs({ gPerKg: 1.6, targetWeightKg: 70 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(Math.round(1.6 * 70));
    });

    it('returns MISSING_DATA when inputs are absent', () => {
        expect(strategy.calculate(inputs({ gPerKg: 1.6 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});
