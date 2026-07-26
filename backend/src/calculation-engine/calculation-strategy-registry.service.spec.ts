import { CalculationStrategyRegistry } from './calculation-strategy-registry.service';
import { CalculationStrategy, CalculationStrategyMeta, StrategyResult } from './interfaces/calculation-strategy.interface';
import { ResultStatus } from '@prisma/client';

function makeStrategy(meta: Partial<CalculationStrategyMeta>): CalculationStrategy {
    const fullMeta: CalculationStrategyMeta = {
        id: 'TEST_ID',
        metricId: 'TEST_METRIC',
        version: 'v1.0.0',
        population: ['ADULT'],
        phase: ['ASSESSMENT'],
        requiredInputs: [],
        outputUnit: 'unit',
        label: 'Test',
        reference: { citation: 'test' },
        ...meta,
    };
    return {
        meta: fullMeta,
        supports: () => true,
        calculate: (): StrategyResult => ({
            metricId: fullMeta.metricId,
            status: ResultStatus.CALCULATED,
            numericValue: 1,
            formulaUsed: fullMeta.id,
            formulaVersion: fullMeta.version,
            engineVersion: 'v1.0.0',
        }),
    };
}

describe('CalculationStrategyRegistry', () => {
    it('throws at bootstrap on duplicate strategy ids', () => {
        const registry = new CalculationStrategyRegistry([
            makeStrategy({ id: 'DUPLICATE_ID' }),
            makeStrategy({ id: 'DUPLICATE_ID' }),
        ]);
        expect(() => registry.onModuleInit()).toThrow('Duplicate calculation strategy id registered: DUPLICATE_ID');
    });

    it('getById throws for an unknown strategy id', () => {
        const registry = new CalculationStrategyRegistry([makeStrategy({ id: 'A' })]);
        registry.onModuleInit();
        expect(() => registry.getById('DOES_NOT_EXIST')).toThrow('Unknown calculation strategy id: DOES_NOT_EXIST');
    });

    it('getForMetric filters by phase and population', () => {
        const assessmentAdult = makeStrategy({ id: 'A', metricId: 'M', phase: ['ASSESSMENT'], population: ['ADULT'] });
        const planAdult = makeStrategy({ id: 'B', metricId: 'M', phase: ['PLAN'], population: ['ADULT'] });
        const assessmentPediatric = makeStrategy({ id: 'C', metricId: 'M', phase: ['ASSESSMENT'], population: ['PEDIATRIC'] });
        const registry = new CalculationStrategyRegistry([assessmentAdult, planAdult, assessmentPediatric]);
        registry.onModuleInit();

        expect(registry.getForMetric('M', 'ASSESSMENT', 'ADULT').map((s) => s.meta.id)).toEqual(['A']);
        expect(registry.getForMetric('M', 'PLAN', 'ADULT').map((s) => s.meta.id)).toEqual(['B']);
        expect(registry.getForMetric('M', 'ASSESSMENT', 'PEDIATRIC').map((s) => s.meta.id)).toEqual(['C']);
        expect(registry.getForMetric('M', 'PLAN', 'PEDIATRIC')).toEqual([]);
    });

    it('listCatalog exposes only id/label/unit/reference, never the formula implementation', () => {
        const registry = new CalculationStrategyRegistry([makeStrategy({ id: 'A', metricId: 'M', label: 'Fórmula A' })]);
        registry.onModuleInit();
        expect(registry.listCatalog('M', 'ASSESSMENT', 'ADULT')).toEqual([
            { id: 'A', label: 'Fórmula A', outputUnit: 'unit', reference: { citation: 'test' } },
        ]);
    });
});
