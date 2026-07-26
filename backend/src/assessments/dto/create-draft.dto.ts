import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class CreateDraftDto {
  @ApiPropertyOptional({ example: '2026-07-26T00:00:00.000Z', description: 'Fecha del Assessment. Si se omite, se usa la fecha actual.' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
