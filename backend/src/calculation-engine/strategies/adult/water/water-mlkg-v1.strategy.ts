import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

const ML_PER_KG = 30;

@Injectable()
export class WaterMlKgV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'WATER_MLKG_V1',
    metricId: 'WATER_ML',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [{ key: 'targetWeightKg', label: 'Peso objetivo (kg)', required: true }],
    outputUnit: 'mL',
    label: 'Por peso corporal (30 mL/kg)',
    reference: {
      citation: 'Regla clínica general de 30-35 mL/kg de peso corporal para adultos sanos, ampliamente usada en la práctica nutricional.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const weight = (inputs.values['targetWeightKg'] as number | undefined) ?? inputs.demographics.weightKg;
    if (weight == null) {
      return { metricId: this.meta.metricId, status: ResultStatus.MISSING_DATA, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion };
    }
    if (weight <= 0) {
      return { metricId: this.meta.metricId, status: ResultStatus.NOT_APPLICABLE, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion, metadataAsJson: { weight } };
    }

    const mL = Math.round(weight * ML_PER_KG);
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: mL,
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      metadataAsJson: { mlPerKg: ML_PER_KG },
      engineVersion,
    };
  }
}
