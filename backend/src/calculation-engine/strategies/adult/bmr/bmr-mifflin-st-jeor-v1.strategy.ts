import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class BmrMifflinStJeorV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMR_MIFFLIN_ST_JEOR_V1',
    metricId: 'BMR',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'm_weight', label: 'Peso (kg)', required: true },
      { key: 'm_height', label: 'Talla (cm)', required: true },
      { key: 'ageYears', label: 'Edad (años)', required: true },
      { key: 'sex', label: 'Sexo', required: true },
    ],
    outputUnit: 'kcal/day',
    label: 'Mifflin-St Jeor',
    reference: {
      citation: 'Mifflin MD, St Jeor ST, Hill LA, et al. A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr. 1990;51(2):241-247.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const weight = inputs.demographics.weightKg;
    const height = inputs.demographics.heightCm;
    const age = inputs.demographics.ageYears;
    const sex = inputs.demographics.sex;

    if (weight == null || height == null || age == null || sex == null) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    if (weight <= 0 || height <= 0 || age <= 0) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.NOT_APPLICABLE,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
        metadataAsJson: { weight, height, age },
      };
    }

    const base = 10 * weight + 6.25 * height - 5 * age;
    const bmr = sex === 'MALE' ? base + 5 : base - 161;

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
