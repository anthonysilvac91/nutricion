import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../interfaces/calculation-strategy.interface';

/**
 * Not a regression estimate -- a validated passthrough of a directly measured
 * m_fat_percent value (e.g. bioimpedance, DEXA, plicometry already resolved
 * upstream). Deurenberg/Jackson-Pollock/Peterson/Siri regressions are
 * explicitly out of scope until their coefficients are clinically approved.
 */
@Injectable()
export class BodyFatMeasuredV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BODY_FAT_MEASURED_V1',
    metricId: 'BODY_FAT_PERCENTAGE',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['ASSESSMENT', 'PLAN'],
    requiredInputs: [{ key: 'm_fat_percent', label: 'Porcentaje de grasa medido (%)', required: true }],
    outputUnit: '%',
    label: 'Porcentaje de grasa medido',
    reference: {
      citation: 'Valor medido directamente (bioimpedancia, DEXA, plicometría u otro método clínico), sin estimación por regresión.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const fatPercent = inputs.values['m_fat_percent'] as number | undefined;

    if (fatPercent == null || !isFinite(fatPercent) || fatPercent <= 0 || fatPercent >= 100) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: parseFloat(fatPercent.toFixed(2)),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      engineVersion,
    };
  }
}
