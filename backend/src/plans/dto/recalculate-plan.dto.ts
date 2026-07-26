import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class MacroPercentsDto {
  @ApiProperty({ example: 15 })
  @IsNumber()
  PROTEIN: number;

  @ApiProperty({ example: 55 })
  @IsNumber()
  CARBS: number;

  @ApiProperty({ example: 30 })
  @IsNumber()
  FAT: number;
}

export enum MacroMethod {
  PERCENT = 'PERCENT',
  GRAMS_PER_KG = 'GRAMS_PER_KG',
}

export class RecalculatePlanDto {
  @ApiProperty({ example: 'BMR_HARRIS_BENEDICT_V1' })
  @IsString()
  bmrFormulaId: string;

  @ApiProperty({ example: 1.55, description: 'Factor de actividad física (PAL) elegido por la nutricionista' })
  @IsNumber()
  pal: number;

  @ApiPropertyOptional({ example: 65 })
  @IsOptional()
  @IsNumber()
  targetWeightKg?: number;

  @ApiPropertyOptional({ example: 1800, description: 'Sobrescribe el GET calculado si la nutricionista fija un objetivo calórico distinto' })
  @IsOptional()
  @IsNumber()
  targetKcalOverride?: number;

  @ApiProperty({ enum: MacroMethod, example: MacroMethod.PERCENT })
  @IsEnum(MacroMethod)
  macroMethod: MacroMethod;

  @ApiPropertyOptional({ type: MacroPercentsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MacroPercentsDto)
  macroPercents?: MacroPercentsDto;

  @ApiPropertyOptional({ example: 1.6, description: 'g de proteína por kg de peso objetivo, usado cuando macroMethod = GRAMS_PER_KG' })
  @IsOptional()
  @IsNumber()
  macroGPerKg?: number;

  @ApiProperty({ example: 'FIBER_IOM_V1' })
  @IsString()
  fiberSourceId: string;

  @ApiProperty({ example: 'WATER_IOM_V1' })
  @IsString()
  waterSourceId: string;
}
