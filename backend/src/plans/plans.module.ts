import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';
import { PlanCalculationService } from './plan-calculation.service';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';

@Module({
    imports: [CalculationEngineModule],
    controllers: [PlansController],
    providers: [PlansService, PlanCalculationService],
    // Se exportan además de PlansController para que EncounterPlanService (corte 4) los
    // reutilice directamente -- misma autoridad clínica de planificación, sin instanciar
    // una segunda copia.
    exports: [PlansService, PlanCalculationService],
})
export class PlansModule {}
