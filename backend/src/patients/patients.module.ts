import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { CalculationEngineModule } from '../calculation-engine/calculation-engine.module';

@Module({
  imports: [CalculationEngineModule],
  controllers: [PatientsController],
  providers: [PatientsService]
})
export class PatientsModule {}
