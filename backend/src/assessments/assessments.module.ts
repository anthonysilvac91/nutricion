import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';
import { ContextResolverService } from './context-resolver.service';

@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsService, ClinicalCalculationEngineService, ContextResolverService],
  exports: [AssessmentsService]
})
export class AssessmentsModule { }
