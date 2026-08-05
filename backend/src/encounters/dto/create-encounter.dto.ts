import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalProfile, EncounterType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsClinicalDateString } from '../../common/clinical-date.util';

// Deliberadamente NO incluye workspaceId, responsibleProfessionalId, flowVersion,
// status, modules, completedAt ni discardedAt -- el ValidationPipe global
// (whitelist + forbidNonWhitelisted, ver app.module.ts) rechaza con 400
// cualquier campo extra que el cliente intente enviar. Esos valores siempre
// los resuelve el backend (EncountersService.create()).
export class CreateEncounterDto {
  @ApiProperty({ enum: ClinicalProfile, example: ClinicalProfile.ADULT_GENERAL })
  @IsEnum(ClinicalProfile, { message: 'profile debe ser uno de: ADULT_GENERAL, ADULT_SPORT, PEDIATRIC' })
  profile: ClinicalProfile;

  @ApiProperty({ enum: EncounterType, example: EncounterType.FIRST_VISIT })
  @IsEnum(EncounterType, { message: 'type debe ser uno de: FIRST_VISIT, FOLLOW_UP, OTHER' })
  type: EncounterType;

  @ApiProperty({ example: '2026-08-04', description: 'Fecha clínica en formato YYYY-MM-DD' })
  @IsClinicalDateString()
  clinicalDate: string;

  @ApiPropertyOptional({ example: 'Control nutricional' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'consultationReason no puede superar 500 caracteres' })
  consultationReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'notes no puede superar 2000 caracteres' })
  notes?: string;
}
