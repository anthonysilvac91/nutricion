import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsClinicalDateString } from '../../common/clinical-date.util';

export class CreateDraftDto {
  @ApiPropertyOptional({ example: '2026-07-26', description: 'Fecha clínica (YYYY-MM-DD) del Assessment. Si se omite, se usa la fecha actual.' })
  @IsOptional()
  @IsClinicalDateString()
  date?: string;
}
