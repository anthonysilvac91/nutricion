import { ResultStatus, Patient } from '@prisma/client';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';
import { BmiAdultV1Strategy } from '../calculation-engine/strategies/adult/bmi-adult-v1.strategy';
import { BodyFatMeasuredV1Strategy } from '../calculation-engine/strategies/adult/body-fat-measured-v1.strategy';
import { TdeeBmrPalV1Strategy } from '../calculation-engine/strategies/adult/tdee-bmr-pal-v1.strategy';
import { BmrHarrisBenedictV1Strategy } from '../calculation-engine/strategies/adult/bmr/bmr-harris-benedict-v1.strategy';
import { BmiPediatricPendingStrategy } from '../calculation-engine/strategies/pediatric/bmi-pediatric-pending.strategy';
import { ClinicalContext } from './context-resolver.service';

function makePatient(overrides: Partial<Patient> = {}): Patient {
    return {
        id: 'patient-1',
        userId: 'user-1',
        firstName: 'Ana',
        lastName: 'Pérez',
        sex: 'FEMALE',
        birthDate: new Date('1994-01-01'),
        activityLevel: 'MODERATE',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    } as Patient;
}

describe('ClinicalCalculationEngineService', () => {
    let engine: ClinicalCalculationEngineService;

    beforeEach(() => {
        const registry = new CalculationStrategyRegistry([
            new BmiAdultV1Strategy(),
            new BodyFatMeasuredV1Strategy(),
            new TdeeBmrPalV1Strategy(),
            new BmrHarrisBenedictV1Strategy(),
            new BmiPediatricPendingStrategy(),
        ]);
        registry.onModuleInit();
        engine = new ClinicalCalculationEngineService(registry);
    });

    it('computes BMI, BMR (Harris-Benedict) and TDEE for an adult with weight+height', () => {
        const context: ClinicalContext = { ageAtAssessmentMonths: 360, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'DEFAULT_ADULT_V1' };
        const patient = makePatient({ activityLevel: 'MODERATE' });
        const results = engine.calculateAll(context, patient, [
            { definitionId: 'm_weight', numericValue: 60 },
            { definitionId: 'm_height', numericValue: 165 },
        ] as any);

        const bmi = results.find((r) => r.metricId === 'BMI');
        const bmr = results.find((r) => r.metricId === 'BMR');
        const tdee = results.find((r) => r.metricId === 'TDEE');

        expect(bmi?.status).toBe(ResultStatus.CALCULATED);
        expect(bmr?.status).toBe(ResultStatus.CALCULATED);
        expect(bmr?.formulaUsed).toBe('BMR_HARRIS_BENEDICT_V1');
        expect(tdee?.status).toBe(ResultStatus.CALCULATED);
        // PAL for MODERATE is fixed at 1.55 -- verify composition, not just presence.
        expect(tdee?.numericValue).toBe(Math.round((bmr?.numericValue ?? 0) * 1.55));
    });

    it('returns BODY_FAT_PERCENTAGE as MISSING_DATA when m_fat_percent was not measured', () => {
        const context: ClinicalContext = { ageAtAssessmentMonths: 360, populationGroup: 'ADULT', specialProfile: 'STANDARD', clinicalProtocol: 'DEFAULT_ADULT_V1' };
        const results = engine.calculateAll(context, makePatient(), [
            { definitionId: 'm_weight', numericValue: 60 },
            { definitionId: 'm_height', numericValue: 165 },
        ] as any);
        const fat = results.find((r) => r.metricId === 'BODY_FAT_PERCENTAGE');
        expect(fat?.status).toBe(ResultStatus.MISSING_DATA);
    });

    it('does not compute BMR/TDEE for a pediatric population and returns PENDING_RULE for BMI', () => {
        const context: ClinicalContext = { ageAtAssessmentMonths: 100, populationGroup: 'PEDIATRIC', specialProfile: 'STANDARD', clinicalProtocol: 'WHO_GROWTH_STANDARDS_V1' };
        const results = engine.calculateAll(context, makePatient(), []);
        expect(results.find((r) => r.metricId === 'BMR')).toBeUndefined();
        expect(results.find((r) => r.metricId === 'TDEE')).toBeUndefined();
        expect(results.find((r) => r.metricId === 'BMI')?.status).toBe(ResultStatus.PENDING_RULE);
    });
});
