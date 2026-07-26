import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  patientId?: string; // populated from route param in controller

  @ApiProperty({ example: 'assessment-uuid', description: 'Evaluación COMPLETED sobre la que se basa el plan' })
  @IsString()
  assessmentId: string;
}
