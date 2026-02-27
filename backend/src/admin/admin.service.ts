import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, SubscriptionStatus } from '@prisma/client';
import { FindNutritionistsDto } from './dto/find-nutritionists.dto';
import { UpdateNutritionistDto } from './dto/update-nutritionist.dto';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    async getStats() {
        const baseWhere = { role: UserRole.NUTRITIONIST };
        const [totalNutritionists, trialing, active, expired, blocked] = await Promise.all([
            this.prisma.user.count({ where: baseWhere }),
            this.prisma.user.count({ where: { ...baseWhere, subscriptionStatus: SubscriptionStatus.TRIALING } }),
            this.prisma.user.count({ where: { ...baseWhere, subscriptionStatus: SubscriptionStatus.ACTIVE } }),
            this.prisma.user.count({ where: { ...baseWhere, subscriptionStatus: SubscriptionStatus.EXPIRED } }),
            this.prisma.user.count({ where: { ...baseWhere, subscriptionStatus: SubscriptionStatus.BLOCKED } }),
        ]);

        return { totalNutritionists, trialing, active, expired, blocked };
    }

    async getNutritionists(query: FindNutritionistsDto) {
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        const skip = (page - 1) * pageSize;
        const search = query.search;

        const where: any = {
            role: UserRole.NUTRITIONIST,
            ...(search && { email: { contains: search, mode: 'insensitive' } }),
        };

        const [data, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                select: { id: true, email: true, createdAt: true, subscriptionStatus: true, trialEndsAt: true },
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    async updateNutritionist(id: string, dto: UpdateNutritionistDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException('User not found');
        if (user.role === UserRole.ADMIN) {
            throw new ForbiddenException('Cannot modify ADMIN users');
        }

        let { subscriptionStatus, trialEndsAt } = user;
        const now = new Date();

        if (dto.block === true) {
            subscriptionStatus = SubscriptionStatus.BLOCKED;
        } else if (dto.block === false) {
            if (subscriptionStatus === SubscriptionStatus.BLOCKED) {
                if (trialEndsAt && trialEndsAt > now) {
                    subscriptionStatus = SubscriptionStatus.TRIALING;
                } else {
                    subscriptionStatus = SubscriptionStatus.EXPIRED;
                }
            }
        }

        if (dto.extendTrialDays && dto.extendTrialDays > 0) {
            const baseDate = trialEndsAt && trialEndsAt > now ? trialEndsAt : now;
            trialEndsAt = new Date(baseDate.getTime() + dto.extendTrialDays * 24 * 60 * 60 * 1000);

            if (subscriptionStatus !== SubscriptionStatus.BLOCKED) {
                subscriptionStatus = SubscriptionStatus.TRIALING;
            }
        }

        if (dto.setStatus) {
            subscriptionStatus = dto.setStatus;
        }

        return this.prisma.user.update({
            where: { id },
            data: { subscriptionStatus, trialEndsAt },
            select: { id: true, email: true, subscriptionStatus: true, trialEndsAt: true },
        });
    }
}
