import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanCalculationService } from './plan-calculation.service';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';

@Module({
    imports: [CalculationEngineModule],
    controllers: [PlansController],
    providers: [PlansService, PlanCalculationService],
})
export class PlansModule {}
