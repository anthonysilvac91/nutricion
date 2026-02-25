// SaaS Guard
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionWriteGuard implements CanActivate {
    constructor(private readonly prisma: PrismaService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userPayload = request.user;

        if (!userPayload?.sub) {
            return false;
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userPayload.sub },
            select: { subscriptionStatus: true, trialEndsAt: true },
        });

        if (!user) {
            return false;
        }

        const now = new Date();

        if (user.subscriptionStatus === SubscriptionStatus.BLOCKED) {
            throw new ForbiddenException({
                code: 'SUBSCRIPTION_BLOCKED',
                message: 'Acceso bloqueado.',
            });
        }

        if (user.subscriptionStatus === SubscriptionStatus.EXPIRED) {
            throw new ForbiddenException({
                code: 'SUBSCRIPTION_READONLY',
                reason: 'trial_expired',
                message: 'El periodo de prueba ha expirado. Modo solo lectura.',
            });
        }

        if (user.subscriptionStatus === SubscriptionStatus.TRIALING) {
            if (user.trialEndsAt && user.trialEndsAt <= now) {
                // Expirar el trial en DB
                await this.prisma.user.update({
                    where: { id: userPayload.sub },
                    data: { subscriptionStatus: SubscriptionStatus.EXPIRED },
                });

                throw new ForbiddenException({
                    code: 'SUBSCRIPTION_READONLY',
                    reason: 'trial_expired',
                    message: 'El periodo de prueba ha expirado. Modo solo lectura.',
                });
            }
            return true;
        }

        if (user.subscriptionStatus === SubscriptionStatus.ACTIVE) {
            return true;
        }

        return false;
    }
}
