import { Injectable } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationInputs,
  StrategyResult,
} from '../../interfaces/calculation-strategy.interface';

@Injectable()
export class BmiAdultV1Strategy implements CalculationStrategy {
  readonly meta: CalculationStrategyMeta = {
    id: 'BMI_ADULT_V1',
    metricId: 'BMI',
    version: 'v1.0.0',
    population: ['ADULT'],
    phase: ['ASSESSMENT'],
    requiredInputs: [
      { key: 'm_weight', label: 'Peso (kg)', required: true },
      { key: 'm_height', label: 'Talla (cm)', required: true },
    ],
    outputUnit: 'kg/m2',
    label: 'IMC estándar (OMS)',
    reference: {
      citation: 'WHO. Physical status: the use and interpretation of anthropometry. Geneva: WHO; 1995 (adult BMI cut-offs).',
    },
  };

  supports(ctx: Pick<CalculationInputs, 'populationGroup'>): boolean {
    return ctx.populationGroup === 'ADULT';
  }

  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult {
    const weight = inputs.values['m_weight'] as number | undefined;
    const heightCm = inputs.values['m_height'] as number | undefined;

    if (weight == null || heightCm == null) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.MISSING_DATA,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
      };
    }

    const heightM = heightCm / 100;
    const bmi = weight / (heightM * heightM);

    if (!isFinite(bmi) || isNaN(bmi) || heightCm <= 0 || weight <= 0) {
      return {
        metricId: this.meta.metricId,
        status: ResultStatus.NOT_APPLICABLE,
        formulaUsed: this.meta.id,
        formulaVersion: this.meta.version,
        engineVersion,
        metadataAsJson: { error: 'Invalid physical values', weight, heightCm },
      };
    }

    let statusCode = 'NORMAL';
    let statusLabel = 'Normal';
    if (bmi < 18.5) {
      statusCode = 'UNDERWEIGHT';
      statusLabel = 'Bajo peso';
    } else if (bmi >= 25 && bmi < 30) {
      statusCode = 'OVERWEIGHT';
      statusLabel = 'Sobrepeso';
    } else if (bmi >= 30) {
      statusCode = 'OBESE';
      statusLabel = 'Obesidad';
    }

    return {
      metricId: this.meta.metricId,
      status: ResultStatus.CALCULATED,
      numericValue: parseFloat(bmi.toFixed(2)),
      unit: this.meta.outputUnit,
      statusCode,
      statusLabel,
      formulaUsed: this.meta.id,
      formulaVersion: this.meta.version,
      referenceTableId: 'WHO_ADULT_CUTOFFS',
      engineVersion,
    };
  }
}
