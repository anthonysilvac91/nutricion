import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class FiberEfsaV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'FIBER_EFSA_V1',
    metricId: 'FIBER_G',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [],
    outputUnit: 'g',
    label: 'EFSA (2010)',
    reference: {
      citation: 'EFSA Panel on Dietetic Products, Nutrition and Allergies. Scientific Opinion on Dietary Reference Values for carbohydrates and dietary fibre. EFSA Journal. 2010;8(3):1462.',
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
      referenceTableId: 'EFSA_2010_FIBER_AI',
      engineVersion,
    };
  }
}
