import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MacroMethod, RecalculatePlanDto } from './dto/recalculate-plan.dto';
import { AssessmentSnapshot, PlanCalculationService } from './plan-calculation.service';
import { ACTIVITY_LEVEL_TO_PAL, DEFAULT_BMR_STRATEGY_ID, DEFAULT_FIBER_SOURCE_ID, DEFAULT_WATER_SOURCE_ID } from '../calculation-engine/defaults';

const ENGINE_VERSION = 'v1.0.0';

@Injectable()
export class PlansService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly planCalculation: PlanCalculationService,
    ) {}

    private async verifyPatientOwnership(userId: string, patientId: string) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId } });
        if (!patient) throw new NotFoundException('Patient not found');
        return patient;
    }

    /** Checks planId, patientId AND userId together -- a plan for another patient must never be reachable even if userId matches. */
    private async verifyPlanOwnership(userId: string, patientId: string, planId: string) {
        const plan = await this.prisma.nutritionalPlan.findFirst({ where: { id: planId, patientId, userId } });
        if (!plan) throw new NotFoundException('Plan not found');
        return plan;
    }

    private async loadCompletedAssessment(patientId: string, assessmentId: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: { id: assessmentId, patientId },
            include: { measurements: true },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'COMPLETED') {
            throw new BadRequestException('Assessment must be COMPLETED to be used for planning');
        }
        return assessment;
    }

    private buildSnapshot(assessment: Prisma.AssessmentGetPayload<{ include: { measurements: true } }>, patient: { sex: string }): AssessmentSnapshot {
        const measurementValues: Record<string, number | string> = {};
        for (const m of assessment.measurements) {
            if (m.numericValue != null) measurementValues[m.definitionId] = m.numericValue;
            else if (m.stringValue) measurementValues[m.definitionId] = m.stringValue;
        }
        return {
            assessmentId: assessment.id,
            date: assessment.date.toISOString(),
            populationGroup: (assessment.populationGroup ?? 'ADULT') as AssessmentSnapshot['populationGroup'],
            sex: patient.sex as 'MALE' | 'FEMALE',
            ageYears: assessment.ageAtAssessmentMonths != null ? Math.floor(assessment.ageAtAssessmentMonths / 12) : 0,
            measurementValues,
        };
    }

    /** Non-clinical starting point for an editable plan objective -- the nutritionist changes any of this via recalculate. */
    private defaultPlanInputs(patient: { activityLevel: string }, snapshot: AssessmentSnapshot): RecalculatePlanDto {
        return {
            bmrFormulaId: DEFAULT_BMR_STRATEGY_ID,
            pal: ACTIVITY_LEVEL_TO_PAL[patient.activityLevel] ?? 1.2,
            targetWeightKg: snapshot.measurementValues['m_weight'] as number | undefined,
            macroMethod: MacroMethod.PERCENT,
            macroPercents: { PROTEIN: 15, CARBS: 55, FAT: 30 },
            fiberSourceId: DEFAULT_FIBER_SOURCE_ID,
            waterSourceId: DEFAULT_WATER_SOURCE_ID,
        };
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
                assessmentId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    // GET /patients/:patientId/plans/:id
    async findOne(userId: string, patientId: string, planId: string) {
        return this.verifyPlanOwnership(userId, patientId, planId);
    }

    // POST /patients/:patientId/plans  ->  crea o devuelve borrador activo, ligado a un Assessment COMPLETED
    async createOrGetDraft(userId: string, patientId: string, dto: CreatePlanDto) {
        const patient = await this.verifyPatientOwnership(userId, patientId);

        const existing = await this.prisma.nutritionalPlan.findFirst({ where: { patientId, userId, status: 'DRAFT' } });
        if (existing) return existing;

        const assessment = await this.loadCompletedAssessment(patientId, dto.assessmentId);
        const snapshot = this.buildSnapshot(assessment, patient);
        const planInputs = this.defaultPlanInputs(patient, snapshot);
        const calculationResults = this.planCalculation.calculate(snapshot, planInputs);

        try {
            return await this.prisma.nutritionalPlan.create({
                data: {
                    patientId,
                    userId,
                    assessmentId: assessment.id,
                    date: new Date(),
                    sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                    calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                    engineVersion: ENGINE_VERSION,
                },
            });
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                // Another concurrent request already created the DRAFT (DB partial-unique-index race).
                return this.prisma.nutritionalPlan.findFirstOrThrow({ where: { patientId, userId, status: 'DRAFT' } });
            }
            throw e;
        }
    }

    // POST /patients/:patientId/plans/:id/recalculate -- the only path that mutates clinical results
    async recalculate(userId: string, patientId: string, planId: string, dto: RecalculatePlanDto) {
        const plan = await this.verifyPlanOwnership(userId, patientId, planId);
        if (plan.status === 'FINALIZED') throw new BadRequestException('Cannot edit a finalized plan. Reopen it first.');

        const patient = await this.verifyPatientOwnership(userId, patientId);
        const assessment = await this.loadCompletedAssessment(patientId, plan.assessmentId);
        const snapshot = this.buildSnapshot(assessment, patient);
        const calculationResults = this.planCalculation.calculate(snapshot, dto);

        return this.prisma.nutritionalPlan.update({
            where: { id: planId },
            data: {
                sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
                calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
                engineVersion: ENGINE_VERSION,
            },
        });
    }

    // POST /patients/:patientId/plans/:id/finalize
    async finalize(userId: string, patientId: string, planId: string) {
        const plan = await this.verifyPlanOwnership(userId, patientId, planId);
        if (plan.status === 'FINALIZED') throw new BadRequestException('Plan is already finalized.');
        return this.prisma.nutritionalPlan.update({
            where: { id: planId },
            data: { status: 'FINALIZED', finalizedAt: new Date() },
        });
    }

    // POST /patients/:patientId/plans/:id/reopen
    async reopen(userId: string, patientId: string, planId: string) {
        const plan = await this.verifyPlanOwnership(userId, patientId, planId);
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
