import { ResultStatus } from '@prisma/client';
import { BmiPediatricPendingStrategy } from './bmi-pediatric-pending.strategy';
import { CalculationInputs } from '../../interfaces/calculation-strategy.interface';

describe('BmiPediatricPendingStrategy', () => {
    it('always returns PENDING_RULE (pediatric out of scope for this phase)', () => {
        const strategy = new BmiPediatricPendingStrategy();
        const inputs: CalculationInputs = { values: {}, demographics: {}, populationGroup: 'PEDIATRIC' };
        const result = strategy.calculate(inputs, 'v1.0.0');
        expect(result.status).toBe(ResultStatus.PENDING_RULE);
    });

    it('supports() only matches PEDIATRIC population', () => {
        const strategy = new BmiPediatricPendingStrategy();
        expect(strategy.supports({ populationGroup: 'PEDIATRIC' })).toBe(true);
        expect(strategy.supports({ populationGroup: 'ADULT' })).toBe(false);
    });
});
