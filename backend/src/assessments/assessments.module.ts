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
  exports: [AssessmentsService]
})
export class AssessmentsModule { }
