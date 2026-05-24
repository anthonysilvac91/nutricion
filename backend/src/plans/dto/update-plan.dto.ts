import { IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  patientValues?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  energyCalc?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  macros?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  micros?: Record<string, any>;
}
