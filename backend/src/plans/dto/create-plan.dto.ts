import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string; // populated from route param in controller
}
