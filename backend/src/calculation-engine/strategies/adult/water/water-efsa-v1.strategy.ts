import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class WaterEfsaV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'WATER_EFSA_V1',
    metricId: 'WATER_ML',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [{ key: 'sex', label: 'Sexo', required: true }],
    outputUnit: 'mL',
    label: 'EFSA (2010)',
    reference: {
      citation: 'EFSA Panel on Dietetic Products, Nutrition and Allergies. Scientific Opinion on Dietary Reference Values for water. EFSA Journal. 2010;8(3):1459.',
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

    const mL = sex === 'MALE' ? 2500 : 2000;
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: mL,
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      referenceTableId: 'EFSA_2010_WATER_AI',
      engineVersion,
    };
  }
}
