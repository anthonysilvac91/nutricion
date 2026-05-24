import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FindNutritionistsDto {
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

    @ApiPropertyOptional({ description: 'Búsqueda por correo electrónico' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Filtro por estado de suscripcion' })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    status?: SubscriptionStatus;
}
