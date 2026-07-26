import { ResultStatus } from '@prisma/client';
import { BmiAdultV1Strategy } from './bmi-adult-v1.strategy';
import { CalculationInputs } from '../../interfaces/calculation-strategy.interface';

function inputs(values: Record<string, number | string | undefined>): CalculationInputs {
    return { values, demographics: {}, populationGroup: 'ADULT' };
}

describe('BmiAdultV1Strategy', () => {
    const strategy = new BmiAdultV1Strategy();

    it('calculates BMI and classifies NORMAL, rounding to 2 decimals', () => {
        const result = strategy.calculate(inputs({ m_weight: 70, m_height: 175 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBeCloseTo(22.86, 2);
        expect(result.statusCode).toBe('NORMAL');
        expect(result.formulaUsed).toBe('BMI_ADULT_V1');
        expect(result.formulaVersion).toBe('v1.0.0');
        expect(result.engineVersion).toBe('v1.0.0');
    });

    it.each([
        [45, 170, 'UNDERWEIGHT'],
        [80, 170, 'OVERWEIGHT'],
        [100, 170, 'OBESE'],
    ])('classifies weight=%s height=%s as %s', (weight, height, expected) => {
        const result = strategy.calculate(inputs({ m_weight: weight, m_height: height }), 'v1.0.0');
        expect(result.statusCode).toBe(expected);
    });

    it('returns MISSING_DATA when weight or height is absent', () => {
        expect(strategy.calculate(inputs({ m_height: 170 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
        expect(strategy.calculate(inputs({ m_weight: 70 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns NOT_APPLICABLE for physically invalid values', () => {
        const result = strategy.calculate(inputs({ m_weight: 70, m_height: 0 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.NOT_APPLICABLE);
    });
});
