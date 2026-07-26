import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class BmrOwenV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMR_OWEN_V1',
    metricId: 'BMR',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'm_weight', label: 'Peso (kg)', required: true },
      { key: 'sex', label: 'Sexo', required: true },
    ],
    outputUnit: 'kcal/day',
    label: 'Ecuación de Owen',
    reference: {
      citation: 'Owen OE, Kavle E, Owen RS, et al. A reappraisal of caloric requirements in healthy women / men. Am J Clin Nutr. 1986/1987.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const weight = inputs.demographics.weightKg;
    const sex = inputs.demographics.sex;

    if (weight == null || sex == null) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    if (weight <= 0) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.NOT_APPLICABLE,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
        metadataAsJson: { weight },
      };
    }

    const bmr = sex === 'MALE' ? 879 + 10.2 * weight : 795 + 7.18 * weight;

    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: Math.round(bmr),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      engineVersion,
    };
  }
}
