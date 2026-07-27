import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class MeasurementRecordDto {
  @ApiProperty({ example: 'm_weight' })
  @IsString()
  definitionId: string;

  @ApiPropertyOptional({ example: 80.5 })
  @IsOptional()
  @IsNumber()
  numericValue?: number;

  @ApiPropertyOptional({ example: '120/80' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  stringValue?: string;

  @ApiPropertyOptional({ example: { source: 'InBody' } })
  @IsOptional()
  metadataAsJson?: any;

  @ApiPropertyOptional({ example: 'Nutricionista Juan' })
  @IsOptional()
  @IsString()
  measuredBy?: string;

  @ApiPropertyOptional({ example: 'Báscula casera' })
  @IsOptional()
  @IsString()
  deviceUsed?: string;
}

export class CreateAssessmentDto {
  @ApiProperty({ example: '2025-10-25T00:00:00.000Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ type: [MeasurementRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasurementRecordDto)
  measurements: MeasurementRecordDto[];
}
