import { ResultStatus } from '@prisma/client';
import { BodyFatMeasuredV1Strategy } from './body-fat-measured-v1.strategy';
import { CalculationInputs } from '../../interfaces/calculation-strategy.interface';

function inputs(values: CalculationInputs['values']): CalculationInputs {
    return { values, demographics: {}, populationGroup: 'ADULT' };
}

describe('BodyFatMeasuredV1Strategy', () => {
    const strategy = new BodyFatMeasuredV1Strategy();

    it('passes through a valid measured value', () => {
        const result = strategy.calculate(inputs({ m_fat_percent: 22.456 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(22.46);
    });

    it('returns MISSING_DATA when no measurement exists', () => {
        expect(strategy.calculate(inputs({}), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns MISSING_DATA for a value outside the physically plausible range', () => {
        expect(strategy.calculate(inputs({ m_fat_percent: 0 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
        expect(strategy.calculate(inputs({ m_fat_percent: 100 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});
