import { ResultStatus } from '@prisma/client';
import { BmrHarrisBenedictV1Strategy } from './bmr-harris-benedict-v1.strategy';
import { BmrMifflinStJeorV1Strategy } from './bmr-mifflin-st-jeor-v1.strategy';
import { BmrKatchMcArdleV1Strategy } from './bmr-katch-mcardle-v1.strategy';
import { BmrOwenV1Strategy } from './bmr-owen-v1.strategy';
import { CalculationInputs } from '../../../interfaces/calculation-strategy.interface';

function inputs(demographics: CalculationInputs['demographics'], values: CalculationInputs['values'] = {}): CalculationInputs {
    return { values, demographics, populationGroup: 'ADULT' };
}

describe('BmrHarrisBenedictV1Strategy', () => {
    const strategy = new BmrHarrisBenedictV1Strategy();

    it('uses the same 1984 revised coefficients for both sexes', () => {
        const male = strategy.calculate(inputs({ sex: 'MALE', ageYears: 30, weightKg: 80, heightCm: 180 }), 'v1.0.0');
        const female = strategy.calculate(inputs({ sex: 'FEMALE', ageYears: 30, weightKg: 60, heightCm: 165 }), 'v1.0.0');
        expect(male.status).toBe(ResultStatus.CALCULATED);
        expect(male.numericValue).toBe(Math.round(88.362 + 13.397 * 80 + 4.799 * 180 - 5.677 * 30));
        expect(female.numericValue).toBe(Math.round(447.593 + 9.247 * 60 + 3.098 * 165 - 4.330 * 30));
    });

    it('returns MISSING_DATA when any demographic input is absent', () => {
        expect(strategy.calculate(inputs({ sex: 'MALE', ageYears: 30, heightCm: 180 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns NOT_APPLICABLE for non-physical values', () => {
        expect(strategy.calculate(inputs({ sex: 'MALE', ageYears: 30, weightKg: -1, heightCm: 180 }), 'v1.0.0').status).toBe(ResultStatus.NOT_APPLICABLE);
    });
});

describe('BmrMifflinStJeorV1Strategy', () => {
    const strategy = new BmrMifflinStJeorV1Strategy();

    it('applies the +5/-161 sex offset', () => {
        const male = strategy.calculate(inputs({ sex: 'MALE', ageYears: 30, weightKg: 80, heightCm: 180 }), 'v1.0.0');
        const female = strategy.calculate(inputs({ sex: 'FEMALE', ageYears: 30, weightKg: 80, heightCm: 180 }), 'v1.0.0');
        expect(male.numericValue).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 + 5));
        expect(female.numericValue).toBe(Math.round(10 * 80 + 6.25 * 180 - 5 * 30 - 161));
    });

    it('returns MISSING_DATA when age is absent', () => {
        expect(strategy.calculate(inputs({ sex: 'MALE', weightKg: 80, heightCm: 180 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});

describe('BmrKatchMcArdleV1Strategy', () => {
    const strategy = new BmrKatchMcArdleV1Strategy();

    it('computes BMR from lean mass when body fat % is provided', () => {
        const result = strategy.calculate(inputs({ weightKg: 80 }, { bodyFatPercent: 20 }), 'v1.0.0');
        const leanMass = 80 * (1 - 20 / 100);
        expect(result.status).toBe(ResultStatus.CALCULATED);
        expect(result.numericValue).toBe(Math.round(370 + 21.6 * leanMass));
    });

    it('never estimates fat% via regression -- returns MISSING_DATA if not measured', () => {
        const result = strategy.calculate(inputs({ weightKg: 80 }, {}), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.MISSING_DATA);
    });

    it('returns NOT_APPLICABLE for an impossible fat percentage', () => {
        const result = strategy.calculate(inputs({ weightKg: 80 }, { bodyFatPercent: 120 }), 'v1.0.0');
        expect(result.status).toBe(ResultStatus.NOT_APPLICABLE);
    });
});

describe('BmrOwenV1Strategy', () => {
    const strategy = new BmrOwenV1Strategy();

    it('computes BMR from weight and sex only', () => {
        const male = strategy.calculate(inputs({ sex: 'MALE', weightKg: 80 }), 'v1.0.0');
        const female = strategy.calculate(inputs({ sex: 'FEMALE', weightKg: 60 }), 'v1.0.0');
        expect(male.numericValue).toBe(Math.round(879 + 10.2 * 80));
        expect(female.numericValue).toBe(Math.round(795 + 7.18 * 60));
    });

    it('returns MISSING_DATA when sex is absent', () => {
        expect(strategy.calculate(inputs({ weightKg: 80 }), 'v1.0.0').status).toBe(ResultStatus.MISSING_DATA);
    });
});
