import { ApiProperty } from '@nestjs/swagger';
import { ActivityLevel, Sex } from '@prisma/client';
import { IsDateString, IsEnum, IsString, MinLength } from 'class-validator';

export class CreatePatientDto {
  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ enum: Sex, example: Sex.MALE })
  @IsEnum(Sex)
  sex: Sex;

  @ApiProperty({ example: '1995-06-15' })
  @IsDateString()
  birthDate: string; // ISO date string

  @ApiProperty({ enum: ActivityLevel, example: ActivityLevel.MODERATE })
  @IsEnum(ActivityLevel)
  activityLevel: ActivityLevel;
}
