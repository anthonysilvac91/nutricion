import { Module } from '@nestjs/common';
import { AssessmentsModule } from '../assessments/assessments.module';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { EncounterAssessmentController } from './encounter-assessment.controller';
import { EncounterAssessmentService } from './encounter-assessment.service';

@Module({
  // AssessmentsModule exporta AssessmentsService + ContextResolverService +
  // ClinicalCalculationEngineService -- EncounterAssessmentService los reutiliza
  // directamente en vez de duplicar la lógica clínica (corte 3).
  imports: [AssessmentsModule],
  controllers: [EncountersController, EncounterAssessmentController],
  providers: [EncountersService, EncounterAssessmentService],
  exports: [EncountersService],
})
export class EncountersModule {}
