import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class DiscardEncounterDto {
  @ApiProperty({ example: 'Paciente no se presentó' })
  // Normaliza antes de validar/persistir: una cadena formada solo por
  // espacios queda vacía tras el trim y la rechaza @IsNotEmpty -- sin esto,
  // "   " pasaría como discardReason "válido" (longitud 3+, no vacío).
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'discardReason es obligatorio' })
  @MinLength(3, { message: 'discardReason debe tener al menos 3 caracteres' })
  @MaxLength(500, { message: 'discardReason no puede superar 500 caracteres' })
  discardReason: string;
}
