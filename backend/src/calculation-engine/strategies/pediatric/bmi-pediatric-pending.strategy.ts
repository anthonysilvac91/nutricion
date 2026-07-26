import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../interfaces/calculation-strategy.interface';

/**
 * Pediatric BMI requires WHO growth-chart Z-scores, not the adult formula.
 * Out of scope for this phase (adult-general only) -- this wraps the
 * existing PENDING_RULE placeholder as a strategy so the orchestrator never
 * special-cases pediatric logic inline.
 */
@Injectable()
export class BmiPediatricPendingStrategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMI_PEDIATRIC_PENDING',
    metricId: 'BMI',
    version: 'v1.0.0',
    population: ['PEDIATRIC'],
    phase: ['ASSESSMENT'],
    requiredInputs: [],
    outputUnit: 'kg/m2',
    label: 'IMC pediátrico (pendiente)',
    reference: { citation: 'Pendiente: requiere tablas de crecimiento OMS por Z-score, fuera de alcance de esta fase.' },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'PEDIATRIC';
  }

  calculate(_inputs: CalculationInputs, engineVersion: string): StrategyResult {
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.PENDING_RULE,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      engineVersion,
    };
  }
}
