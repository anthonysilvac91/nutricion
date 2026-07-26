import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

const KCAL_PER_GRAM = 4;

@Injectable()
export class MacroProteinGramsFromPercentV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'MACRO_PROTEIN_GRAMS_FROM_PERCENT_V1',
    metricId: 'PROTEIN_G',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'getKcal', label: 'GET (kcal/día)', required: true },
      { key: 'percent', label: 'Porcentaje de proteínas (%)', required: true },
    ],
    outputUnit: 'g',
    label: 'Porcentaje del GET',
    reference: { citation: 'Factor de Atwater: 4 kcal/g de proteína.' },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const getKcal = inputs.values['getKcal'] as number | undefined;
    const percent = inputs.values['percent'] as number | undefined;

    if (getKcal == null || percent == null) {
      return { metricId: this.meta.metricId, status: ResultStatus.MISSING_DATA, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion };
    }
    if (getKcal <= 0 || percent < 0 || percent > 100) {
      return { metricId: this.meta.metricId, status: ResultStatus.NOT_APPLICABLE, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion, metadataAsJson: { getKcal, percent } };
    }

    const grams = (getKcal * (percent / 100)) / KCAL_PER_GRAM;
    const targetWeightKg = inputs.values['targetWeightKg'] as number | undefined;
    const gPerKg = targetWeightKg ? parseFloat((grams / targetWeightKg).toFixed(2)) : undefined;
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: Math.round(grams),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      metadataAsJson: { percent, kcalPerGram: KCAL_PER_GRAM, gPerKg },
      engineVersion,
    };
  }
}
