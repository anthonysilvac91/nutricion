import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { CALCULATION_STRATEGY } from './tokens';
import {
  CalculationStrategy,
  CalculationStrategyMeta,
  CalculationPhase,
  PopulationGroup,
} from './interfaces/calculation-strategy.interface';

@Injectable()
export class CalculationStrategyRegistry implements OnModuleInit {
  private readonly byId = new Map<string, CalculationStrategy>();
  private readonly byMetric = new Map<string, CalculationStrategy[]>();

  constructor(@Inject(CALCULATION_STRATEGY) private readonly strategies: CalculationStrategy[]) {}

  onModuleInit() {
    for (const s of this.strategies) {
      if (this.byId.has(s.meta.id)) {
        throw new Error(`Duplicate calculation strategy id registered: ${s.meta.id}`);
      }
      this.byId.set(s.meta.id, s);
      const list = this.byMetric.get(s.meta.metricId) ?? [];
      list.push(s);
      this.byMetric.set(s.meta.metricId, list);
    }
  }

  getById(strategyId: string): CalculationStrategy {
    const s = this.byId.get(strategyId);
    if (!s) throw new Error(`Unknown calculation strategy id: ${strategyId}`);
    return s;
  }

  /** Non-throwing existence+eligibility check, for validation/blocker logic that must never crash on a bad id. */
  isUsableForPlan(strategyId: string | undefined, population: PopulationGroup): boolean {
    if (!strategyId) return false;
    const s = this.byId.get(strategyId);
    if (!s) return false;
    return s.meta.phase.includes('PLAN') && s.meta.population.includes(population);
  }

  /** Non-throwing variant of getById, for read-only metadata lookups (e.g. calculationMetadata) that must never crash on a stale/unknown id. */
  byIdOrNull(strategyId: string): CalculationStrategy | null {
    return this.byId.get(strategyId) ?? null;
  }

  getForMetric(metricId: string, phase: CalculationPhase, population: PopulationGroup): CalculationStrategy[] {
    return (this.byMetric.get(metricId) ?? []).filter(
      (s) => s.meta.phase.includes(phase) && s.meta.population.includes(population),
    );
  }

  /** Lightweight catalog for UI selects: id, label, unit, reference, per phase/population. Never expose raw formulas to the frontend, only this metadata. */
  listCatalog(metricId: string, phase: CalculationPhase, population: PopulationGroup): Pick<CalculationStrategyMeta, 'id' | 'label' | 'outputUnit' | 'reference'>[] {
    return this.getForMetric(metricId, phase, population).map((s) => ({
      id: s.meta.id,
      label: s.meta.label,
      outputUnit: s.meta.outputUnit,
      reference: s.meta.reference,
    }));
  }
}
