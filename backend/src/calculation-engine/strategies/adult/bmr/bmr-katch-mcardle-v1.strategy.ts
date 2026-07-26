import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

/**
 * Requires a directly measured body fat percentage to derive lean body mass.
 * Never falls back to a regression estimate of fat% -- if no measured value
 * exists, this strategy returns MISSING_DATA rather than guessing.
 */
@Injectable()
export class BmrKatchMcArdleV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMR_KATCH_MCARDLE_V1',
    metricId: 'BMR',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'm_weight', label: 'Peso (kg)', required: true },
      { key: 'bodyFatPercent', label: 'Porcentaje de grasa medido (%)', required: true },
    ],
    outputUnit: 'kcal/day',
    label: 'Katch-McArdle (requiere % de grasa medido)',
    reference: {
      citation: 'Katch FI, McArdle WD. Nutrition, Weight Control, and Exercise. 3rd ed. Philadelphia: Lea & Febiger; 1988.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const weight = inputs.demographics.weightKg;
    const fatPercent = inputs.values['bodyFatPercent'] as number | undefined;

    if (weight == null || fatPercent == null) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    if (weight <= 0 || fatPercent < 0 || fatPercent >= 100) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.NOT_APPLICABLE,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
        metadataAsJson: { weight, fatPercent },
      };
    }

    const leanMass = weight * (1 - fatPercent / 100);
    const bmr = 370 + 21.6 * leanMass;

    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: Math.round(bmr),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      metadataAsJson: { leanMassKg: parseFloat(leanMass.toFixed(2)) },
      engineVersion,
    };
  }
}
