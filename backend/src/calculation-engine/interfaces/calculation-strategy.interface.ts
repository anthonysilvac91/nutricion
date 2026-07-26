import { ResultStatus } from '@prisma/client';

export type PopulationGroup = 'ADULT' | 'PEDIATRIC' | 'GERIATRIC';
export type CalculationPhase = 'ASSESSMENT' | 'PLAN';

export interface StrategyInputSpec {
  key: string;
  label: string;
  required: boolean;
}

export interface StrategyReference {
  citation: string;
  notes?: string;
}

export interface CalculationStrategyMeta {
  /** Stable identifier, persisted verbatim in CalculatedResult.formulaUsed / calculationResults. */
  id: string;
  /** Logical metric this strategy produces (e.g. 'BMI', 'BMR', 'PROTEIN_G'). Not all metrics are FK'd to MetricDefinition. */
  metricId: string;
  version: string;
  population: PopulationGroup[];
  phase: CalculationPhase[];
  requiredInputs: StrategyInputSpec[];
  outputUnit: string;
  reference: StrategyReference;
  /** Human-readable label for UI selects (formula/source pickers). */
  label: string;
}

export interface CalculationInputs {
  values: Record<string, number | string | undefined>;
  demographics: {
    sex?: 'MALE' | 'FEMALE';
    ageYears?: number;
    weightKg?: number;
    heightCm?: number;
  };
  populationGroup: PopulationGroup;
}

export interface StrategyResult {
  metricId: string;
  status: ResultStatus;
  numericValue?: number;
  stringValue?: string;
  unit?: string;
  statusCode?: string;
  statusLabel?: string;
  metadataAsJson?: Record<string, unknown>;
  formulaUsed: string;
  formulaVersion: string;
  referenceTableId?: string;
  engineVersion: string;
}

export interface CalculationStrategy {
  readonly meta: CalculationStrategyMeta;
  supports(context: Pick<CalculationInputs, 'populationGroup'>): boolean;
  calculate(inputs: CalculationInputs, engineVersion: string): StrategyResult;
}
