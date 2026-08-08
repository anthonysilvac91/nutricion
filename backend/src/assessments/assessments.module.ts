import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';
import { ContextResolverService } from './context-resolver.service';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';
import { MeasurementSummaryService } from './measurement-summary.service';

@Module({
  imports: [CalculationEngineModule],
  controllers: [AssessmentsController],
  providers: [AssessmentsService, ClinicalCalculationEngineService, ContextResolverService, MeasurementSummaryService],
  // ClinicalCalculationEngineService y ContextResolverService se exportan además de
  // AssessmentsService para que EncounterAssessmentService (corte 3) los reutilice
  // directamente -- misma autoridad de cálculo, sin instanciar una segunda copia.
  exports: [AssessmentsService, ClinicalCalculationEngineService, ContextResolverService]
})
export class AssessmentsModule { }
