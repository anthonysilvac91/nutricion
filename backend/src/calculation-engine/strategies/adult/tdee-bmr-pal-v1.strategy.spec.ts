import { ResultStatus } from '@prisma/client';
import { TdeeBmrPalV1Strategy } from './tdee-bmr-pal-v1.strategy';
import { CalculationInputs } from '../../interfaces/calculation-strategy.interface';

function inputs(values: CalculationInputs['values']): CalculationInputs {
    return { values, demographics: {}, populationGroup: 'ADULT' };
}

describe('TdeeBmrPalV1Strategy', () => {
    const strategy = new TdeeBmrPalV1Strategy();

    it('computes TDEE = BMR x PAL, rounded', () => {
        const result = strategy.calculate(inputs({ bmrValue: 1500, palValue: 1.55 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(Math.round(1500 * 1.55));
        expect(result.formulaUsed).toBe('TDEE_BMR_PAL_V1');
    });

    it('returns MISSING_DATA when BMR or PAL is absent', () => {
        expect(strategy.calculate(inputs({ palValue: 1.2 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
        expect(strategy.calculate(inputs({ bmrValue: 1500 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns NOT_APPLICABLE when PAL is outside the physiologically sustainable range', () => {
        expect(strategy.calculate(inputs({ bmrValue: 1500, palValue: 0.5 }), 'v1.0.0').status).toBe(ResultStatus.NOT_APPLICABLE);
        expect(strategy.calculate(inputs({ bmrValue: 1500, palValue: 3.0 }), 'v1.0.0').status).toBe(ResultStatus.NOT_APPLICABLE);
    });
});
