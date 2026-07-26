import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../interfaces/calculation-strategy.interface';

/**
 * Deliberately does not call a BMR strategy internally -- strategies never
 * call each other. Composition (BMR -> TDEE) happens in the orchestrator,
 * which is what lets this same strategy serve both a fixed baseline BMR
 * (assessment time) and a nutritionist-chosen BMR (plan time).
 */
@Injectable()
export class TdeeBmrPalV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'TDEE_BMR_PAL_V1',
    metricId: 'TDEE',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['ASSESSMENT', 'PLAN'],
    requiredInputs: [
      { key: 'bmrValue', label: 'BMR (kcal/día)', required: true },
      { key: 'palValue', label: 'Factor de actividad (PAL)', required: true },
    ],
    outputUnit: 'kcal/day',
    label: 'GET = BMR × PAL',
    reference: {
      citation: 'FAO/WHO/UNU Expert Consultation. Human Energy Requirements. Rome: FAO; 2004 (factorial method, TDEE = BMR x PAL).',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const bmr = inputs.values['bmrValue'] as number | undefined;
    const pal = inputs.values['palValue'] as number | undefined;

    if (bmr == null || pal == null) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    if (!isFinite(bmr) || bmr <= 0 || !isFinite(pal) || pal < 1.0 || pal > 2.5) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.NOT_APPLICABLE,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
        metadataAsJson: { bmrValue: bmr, palValue: pal },
      };
    }

    const tdee = bmr * pal;
    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: Math.round(tdee),
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      metadataAsJson: { bmrValue: bmr, palValue: pal },
      engineVersion,
    };
  }
}
