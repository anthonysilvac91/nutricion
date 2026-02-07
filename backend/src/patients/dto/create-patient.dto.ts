import { ApiProperty } from '@nestjs/swagger';
import { ActivityLevel, Sex } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty({ example: 'Juan' })
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiProperty({ enum: Sex, example: Sex.MALE })
  sex: Sex;

  @ApiProperty({ example: '1995-06-15' })
  birthDate: string; // ISO date string

  @ApiProperty({ enum: ActivityLevel, example: ActivityLevel.MODERATE })
  activityLevel: ActivityLevel;
}
