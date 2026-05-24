import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
    constructor(private readonly prisma: PrismaService) {}

    private async verifyPatientOwnership(userId: string, patientId: string) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId } });
        if (!patient) throw new NotFoundException('Patient not found');
        return patient;
    }

    private async verifyPlanOwnership(userId: string, planId: string) {
        const plan = await this.prisma.nutritionalPlan.findFirst({ where: { id: planId, userId } });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    // GET /patients/:patientId/plans
    async findAll(userId: string, patientId: string) {
        await this.verifyPatientOwnership(userId, patientId);
        return this.prisma.nutritionalPlan.findMany({
            where: { patientId, userId },
            orderBy: { date: 'desc' },
            select: {
                id: true,
                status: true,
                date: true,
                finalizedAt: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    // GET /patients/:patientId/plans/:id
    async findOne(userId: string, patientId: string, planId: string) {
        await this.verifyPatientOwnership(userId, patientId);
        const plan = await this.prisma.nutritionalPlan.findFirst({
            where: { id: planId, patientId, userId },
        });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    // POST /patients/:patientId/plans  →  creates or returns existing DRAFT
    async createOrGetDraft(userId: string, patientId: string) {
        await this.verifyPatientOwnership(userId, patientId);
        const existing = await this.prisma.nutritionalPlan.findFirst({
            where: { patientId, userId, status: 'DRAFT' },
        });
        if (existing) return existing;
        return this.prisma.nutritionalPlan.create({
            data: { patientId, userId, date: new Date() },
        });
    }

    // PATCH /patients/:patientId/plans/:id
    async save(userId: string, patientId: string, planId: string, dto: UpdatePlanDto) {
        const plan = await this.verifyPlanOwnership(userId, planId);
        if (plan.status === 'FINALIZED') throw new BadRequestException('Cannot edit a finalized plan. Reopen it first.');
        return this.prisma.nutritionalPlan.update({
            where: { id: planId },
            data: {
                ...(dto.patientValues !== undefined && { patientValues: dto.patientValues }),
                ...(dto.energyCalc    !== undefined && { energyCalc:    dto.energyCalc    }),
                ...(dto.macros        !== undefined && { macros:        dto.macros        }),
                ...(dto.micros        !== undefined && { micros:        dto.micros        }),
            },
        });
    }

    // POST /patients/:patientId/plans/:id/finalize
    async finalize(userId: string, patientId: string, planId: string) {
        const plan = await this.verifyPlanOwnership(userId, planId);
        if (plan.status === 'FINALIZED') throw new BadRequestException('Plan is already finalized.');
        return this.prisma.nutritionalPlan.update({
            where: { id: planId },
            data: { status: 'FINALIZED', finalizedAt: new Date() },
        });
    }

    // POST /patients/:patientId/plans/:id/reopen
    async reopen(userId: string, patientId: string, planId: string) {
        const plan = await this.verifyPlanOwnership(userId, planId);
        if (plan.status === 'DRAFT') throw new BadRequestException('Plan is already a draft.');
        const activeDraft = await this.prisma.nutritionalPlan.findFirst({
            where: { patientId, userId, status: 'DRAFT' },
        });
        if (activeDraft) throw new BadRequestException('There is already an active draft for this patient. Finalize it before reopening another plan.');
        return this.prisma.nutritionalPlan.update({
            where: { id: planId },
            data: { status: 'DRAFT', finalizedAt: null },
        });
    }
}
