import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class WaterIomV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'WATER_IOM_V1',
    metricId: 'WATER_ML',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [{ key: 'sex', label: 'Sexo', required: true }],
    outputUnit: 'mL',
    label: 'IOM / NAS (2005)',
    reference: {
      citation: 'Institute of Medicine. Dietary Reference Intakes for Water, Potassium, Sodium, Chloride, and Sulfate. Washington DC: National Academies Press; 2005.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const sex = inputs.demographics.sex;
    if (sex == null) {
      return { metricId: this.meta.metricId, status: ResultStatus.MISSING_DATA, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion };
    }

    const mL = sex === 'MALE' ? 3700 : 2700;
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: mL,
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      referenceTableId: 'IOM_2005_WATER_AI',
      engineVersion,
    };
  }
}
