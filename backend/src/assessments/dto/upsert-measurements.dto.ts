import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { MeasurementRecordDto } from './create-assessment.dto';

export class UpsertMeasurementsDto {
  @ApiProperty({ type: [MeasurementRecordDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeasurementRecordDto)
  measurements: MeasurementRecordDto[];
}
