import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClinicalProfile, EncounterStatus, EncounterType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class FindEncountersDto {
  @ApiPropertyOptional({ description: 'Página actual', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Cantidad de elementos por página', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;

  @ApiPropertyOptional({ enum: EncounterStatus })
  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @ApiPropertyOptional({ enum: ClinicalProfile })
  @IsOptional()
  @IsEnum(ClinicalProfile)
  profile?: ClinicalProfile;

  @ApiPropertyOptional({ enum: EncounterType })
  @IsOptional()
  @IsEnum(EncounterType)
  type?: EncounterType;
}
