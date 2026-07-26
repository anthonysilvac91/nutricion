import { Injectable } from '@nestjs/common';
import { ClinicalContext } from './context-resolver.service';
import { MeasurementRecordDto } from './dto/create-assessment.dto';
import { Patient } from '@prisma/client';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';
import { CalculationInputs, PopulationGroup, StrategyResult } from '../calculation-engine/interfaces/calculation-strategy.interface';
import { ACTIVITY_LEVEL_TO_PAL, DEFAULT_BMR_STRATEGY_ID } from '../calculation-engine/defaults';

export type EngineResult = StrategyResult;

@Injectable()
export class ClinicalCalculationEngineService {
    private readonly ENGINE_VERSION = 'v1.0.0';

    constructor(private readonly registry: CalculationStrategyRegistry) { }

    calculateAll(
        context: ClinicalContext,
        patient: Patient,
        measurements: MeasurementRecordDto[],
    ): EngineResult[] {
        const values: Record<string, number | string> = {};
        for (const m of measurements) {
            if (m.numericValue !== undefined && m.numericValue !== null) {
                values[m.definitionId] = m.numericValue;
            } else if (m.stringValue) {
                values[m.definitionId] = m.stringValue;
            }
        }

        const population = context.populationGroup as PopulationGroup;
        const inputs: CalculationInputs = {
            values,
            demographics: {
                sex: patient.sex as 'MALE' | 'FEMALE',
                ageYears: Math.floor(context.ageAtAssessmentMonths / 12),
                weightKg: values['m_weight'] as number | undefined,
                heightCm: values['m_height'] as number | undefined,
            },
            populationGroup: population,
        };

        const results: EngineResult[] = [];

        for (const metricId of ['BMI', 'BODY_FAT_PERCENTAGE']) {
            for (const strategy of this.registry.getForMetric(metricId, 'ASSESSMENT', population)) {
                results.push(strategy.calculate(inputs, this.ENGINE_VERSION));
            }
        }

        if (population !== 'ADULT') {
            // Pediatric/geriatric BMR/TDEE baseline out of scope for this phase.
            return results;
        }

        const bmrResult = this.registry.getById(DEFAULT_BMR_STRATEGY_ID).calculate(inputs, this.ENGINE_VERSION);
        results.push(bmrResult);

        const pal = ACTIVITY_LEVEL_TO_PAL[patient.activityLevel];
        const tdeeInputs: CalculationInputs = {
            ...inputs,
            values: { ...inputs.values, bmrValue: bmrResult.numericValue, palValue: pal },
        };
        results.push(this.registry.getById('TDEE_BMR_PAL_V1').calculate(tdeeInputs, this.ENGINE_VERSION));

        return results;
    }
}
