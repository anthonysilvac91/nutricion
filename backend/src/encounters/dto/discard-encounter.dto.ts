import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class DiscardEncounterDto {
  @ApiProperty({ example: 'Paciente no se presentó' })
  @IsString()
  @IsNotEmpty({ message: 'discardReason es obligatorio' })
  @MinLength(3, { message: 'discardReason debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'discardReason no puede superar 500 caracteres' })
  discardReason: string;
}
