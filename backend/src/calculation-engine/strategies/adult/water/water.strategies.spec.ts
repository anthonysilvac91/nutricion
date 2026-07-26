import { ResultStatus } from '@prisma/client';
import { WaterIomV1Strategy } from './water-iom-v1.strategy';
import { WaterEfsaV1Strategy } from './water-efsa-v1.strategy';
import { WaterMlKgV1Strategy } from './water-mlkg-v1.strategy';
import { CalculationInputs } from '../../../interfaces/calculation-strategy.interface';

function inputs(demographics: CalculationInputs['demographics'] = {}, values: CalculationInputs['values'] = {}): CalculationInputs {
    return { values, demographics, populationGroup: 'ADULT' };
}

describe('WaterIomV1Strategy', () => {
    const strategy = new WaterIomV1Strategy();

    it('returns 3700 mL for males and 2700 mL for females', () => {
        expect(strategy.calculate(inputs({ sex: 'MALE' }), 'v1.0.0').numericValue).toBe(3700);
        expect(strategy.calculate(inputs({ sex: 'FEMALE' }), 'v1.0.0').numericValue).toBe(2700);
    });

    it('returns MISSING_DATA when sex is absent', () => {
        expect(strategy.calculate(inputs({}), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});

describe('WaterEfsaV1Strategy', () => {
    it('returns 2500 mL for males and 2000 mL for females', () => {
        const strategy = new WaterEfsaV1Strategy();
        expect(strategy.calculate(inputs({ sex: 'MALE' }), 'v1.0.0').numericValue).toBe(2500);
        expect(strategy.calculate(inputs({ sex: 'FEMALE' }), 'v1.0.0').numericValue).toBe(2000);
    });
});

describe('WaterMlKgV1Strategy', () => {
    const strategy = new WaterMlKgV1Strategy();

    it('returns weight * 30 mL/kg, preferring the plan target weight over the snapshot weight', () => {
        const result = strategy.calculate(inputs({ weightKg: 70 }, { targetWeightKg: 65 }), 'v1.0.0');
        expect(result.numericValue).toBe(65 * 30);
    });

    it('falls back to demographic weight when no target weight override is given', () => {
        const result = strategy.calculate(inputs({ weightKg: 70 }, {}), 'v1.0.0');
        expect(result.numericValue).toBe(70 * 30);
    });

    it('returns MISSING_DATA when no weight is available at all', () => {
        expect(strategy.calculate(inputs({}, {}), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});
