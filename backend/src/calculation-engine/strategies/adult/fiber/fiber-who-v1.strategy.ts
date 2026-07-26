import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class FiberWhoV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'FIBER_WHO_V1',
    metricId: 'FIBER_G',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [],
    outputUnit: 'g',
    label: 'OMS / FAO (2003)',
    reference: {
      citation: 'WHO/FAO Joint Expert Consultation. Diet, Nutrition and the Prevention of Chronic Diseases. WHO Technical Report Series 916. Geneva: WHO; 2003 (mínimo 25 g/día).',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(_inputs: CalculationInputs, engineVersion: string): StrategyResult {
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: 25,
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      referenceTableId: 'WHO_FAO_2003_FIBER_MIN',
      engineVersion,
    };
  }
}
