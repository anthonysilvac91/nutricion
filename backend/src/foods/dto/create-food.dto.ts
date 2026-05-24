import { IsString, IsOptional, IsNumber, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFoodDto {
  @ApiProperty({ description: 'Nombre del alimento' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Nombre en español' })
  @IsOptional()
  @IsString()
  nameEs?: string;

  @ApiPropertyOptional({ description: 'Categoría (ej: Carnes, Lácteos)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Energía (kcal / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  energy?: number;

  @ApiPropertyOptional({ description: 'Proteínas (g / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  protein?: number;

  @ApiPropertyOptional({ description: 'Hidratos de carbono (g / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  carbs?: number;

  @ApiPropertyOptional({ description: 'Lípidos (g / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fat?: number;

  @ApiPropertyOptional({ description: 'Fibra (g / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fiber?: number;

  @ApiPropertyOptional({ description: 'Azúcar (g / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sugar?: number;

  @ApiPropertyOptional({ description: 'Sodio (mg / 100g)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sodium?: number;

  @ApiPropertyOptional({ description: 'Nutrientes extendidos (JSON libre)' })
  @IsOptional()
  @IsObject()
  nutrients?: Record<string, number>;
}
