import { ResultStatus } from '@prisma/client';
import { FiberIomV1Strategy } from './fiber-iom-v1.strategy';
import { FiberEfsaV1Strategy } from './fiber-efsa-v1.strategy';
import { FiberWhoV1Strategy } from './fiber-who-v1.strategy';
import { CalculationInputs } from '../../../interfaces/calculation-strategy.interface';

function inputs(demographics: CalculationInputs['demographics']): CalculationInputs {
    return { values: {}, demographics, populationGroup: 'ADULT' };
}

describe('FiberIomV1Strategy', () => {
    const strategy = new FiberIomV1Strategy();

    it.each([
        ['MALE', 30, 38],
        ['MALE', 55, 30],
        ['FEMALE', 30, 25],
        ['FEMALE', 55, 21],
    ])('sex=%s age=%s -> %s g/day (IOM 2005 age-adjusted AI)', (sex, age, expected) => {
        const result = strategy.calculate(inputs({ sex: sex as 'MALE' | 'FEMALE', ageYears: age as number }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(expected);
    });

    it('returns MISSING_DATA when sex or age is absent', () => {
        expect(strategy.calculate(inputs({ sex: 'MALE' }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});

describe('FiberEfsaV1Strategy', () => {
    it('returns a flat 25 g/day regardless of sex/age', () => {
        const strategy = new FiberEfsaV1Strategy();
        const result = strategy.calculate(inputs({}), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(25);
    });
});

describe('FiberWhoV1Strategy', () => {
    it('returns a flat 25 g/day minimum', () => {
        const strategy = new FiberWhoV1Strategy();
        const result = strategy.calculate(inputs({}), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(25);
    });
});
