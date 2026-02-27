import { ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateNutritionistDto {
    @ApiPropertyOptional({ description: 'Bloquear o desbloquear al usuario' })
    @IsOptional()
    @IsBoolean()
    block?: boolean;

    @ApiPropertyOptional({ description: 'Dias a extender el periodo de prueba' })
    @IsOptional()
    @IsInt()
    @Min(1)
    extendTrialDays?: number;

    @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Estado de la suscripción manual' })
    @IsOptional()
    @IsEnum(SubscriptionStatus)
    setStatus?: SubscriptionStatus;
}
