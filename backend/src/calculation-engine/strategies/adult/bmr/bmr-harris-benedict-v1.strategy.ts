import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

/**
 * Revised Harris-Benedict coefficients (Roza & Shizgal, 1984), same revision
 * for both sexes. This is the fixed formula used for the non-editable
 * baseline BMR computed at Assessment time; it is also offered as a
 * selectable option at Plan time.
 */
@Injectable()
export class BmrHarrisBenedictV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMR_HARRIS_BENEDICT_V1',
    metricId: 'BMR',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['ASSESSMENT', 'PLAN'],
    requiredInputs: [
      { key: 'm_weight', label: 'Peso (kg)', required: true },
      { key: 'm_height', label: 'Talla (cm)', required: true },
      { key: 'ageYears', label: 'Edad (años)', required: true },
      { key: 'sex', label: 'Sexo', required: true },
    ],
    outputUnit: 'kcal/day',
    label: 'Harris-Benedict revisada (Roza & Shizgal 1984)',
    reference: {
      citation: 'Roza AM, Shizgal HM. The Harris Benedict equation reevaluated: resting energy requirements and the body cell mass. Am J Clin Nutr. 1984;40(1):168-182.',
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

    const bmr = sex === 'MALE'
      ? 88.362 + 13.397 * weight + 4.799 * height - 5.677 * age
      : 447.593 + 9.247 * weight + 3.098 * height - 4.330 * age;

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
