import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../../interfaces/calculation-strategy.interface';

@Injectable()
export class FiberIomV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'FIBER_IOM_V1',
    metricId: 'FIBER_G',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['PLAN'],
    requiredInputs: [
      { key: 'sex', label: 'Sexo', required: true },
      { key: 'ageYears', label: 'Edad (años)', required: true },
    ],
    outputUnit: 'g',
    label: 'IOM / Food and Nutrition Board (2005)',
    reference: {
      citation: 'Institute of Medicine. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. Washington DC: National Academies Press; 2005.',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const sex = inputs.demographics.sex;
    const age = inputs.demographics.ageYears;

    if (sex == null || age == null) {
      return { metricId: this.meta.metricId, status: ResultStatus.MISSING_DATA, formulaUsed: this.meta.id, formulaVersion: this.meta.version, engineVersion };
    }

    const isOver50 = age > 50;
    const grams = sex === 'MALE' ? (isOver50 ? 30 : 38) : (isOver50 ? 21 : 25);

    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: grams,
      unit: this.meta.outputUnit,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      referenceTableId: 'IOM_2005_FIBER_AI',
      engineVersion,
    };
  }
}
