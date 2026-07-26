import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

/** Alternate prescription method: protein by g/kg of target body weight instead of % of GET. */
@Injectable()
export class MacroProteinGramsPerKgV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'MACRO_PROTEIN_GRAMS_PER_KG_V1',
    metricId: 'PROTEIN_G',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'gPerKg', label: 'g de proteína por kg de peso objetivo', required: true },
      { key: 'targetWeightKg', label: 'Peso objetivo (kg)', required: true },
    ],
    outputUnit: 'g',
    label: 'Gramos por kg de peso objetivo',
    reference: { citation: 'Prescripción clínica habitual por g/kg de peso corporal, elegida por la nutricionista en vez de % del GET.' },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const gPerKg = inputs.values['gPerKg'] as number | undefined;
    const targetWeightKg = inputs.values['targetWeightKg'] as number | undefined;

    if (gPerKg == null || targetWeightKg == null) {
      return { metricId: this.meta.metricId, status: ResultStatus.MISSING_DATA, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion };
    }
    if (gPerKg < 0 || targetWeightKg <= 0) {
      return { metricId: this.meta.metricId, status: ResultStatus.NOT_APPLICABLE, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion, metadataAsJson: { gPerKg, targetWeightKg } };
    }

    const grams = gPerKg * targetWeightKg;
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: Math.round(grams),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      metadataAsJson: { gPerKg, targetWeightKg },
      engineVersion,
    };
  }
}
