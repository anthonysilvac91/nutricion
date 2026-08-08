import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../assessments/assessments.module';
import { PlansModule } from '../plans/plans.module';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { EncounterAssessmentController } from './encounter-assessment.controller';
import { EncounterAssessmentService } from './encounter-assessment.service';
import { EncounterPlanController } from './encounter-plan.controller';
import { EncounterPlanService } from './encounter-plan.service';

@Module({
  // AssessmentsModule exporta AssessmentsService + ContextResolverService +
  // ClinicalCalculationEngineService -- EncounterAssessmentService los reutiliza
  // directamente en vez de duplicar la lógica clínica (corte 3). PlansModule
  // exporta PlansService + PlanCalculationService -- EncounterPlanService los
  // reutiliza igual, sin duplicar la autoridad de planificación (corte 4).
  imports: [AssessmentsModule, PlansModule],
  controllers: [EncountersController, EncounterAssessmentController, EncounterPlanController],
  providers: [EncountersService, EncounterAssessmentService, EncounterPlanService],
  exports: [EncountersService],
})
export class EncountersModule {}
