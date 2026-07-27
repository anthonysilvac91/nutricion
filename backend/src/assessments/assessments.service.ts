import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssessmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssessmentDto, MeasurementRecordDto } from './dto/create-assessment.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { UpsertMeasurementsDto } from './dto/upsert-measurements.dto';
import { ContextResolverService } from './context-resolver.service';
import { ClinicalCalculationEngineService, EngineResult } from './clinical-calculation-engine.service';

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AssessmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly contextResolver: ContextResolverService,
        private readonly engine: ClinicalCalculationEngineService,
    ) { }

    /** Pure shape validation -- no DB access, safe to call before opening a transaction. */
    private validateMeasurementsShape(measurements: MeasurementRecordDto[]): void {
        if (!measurements || measurements.length === 0) {
            throw new BadRequestException('At least one measurement is required');
        }

        const definitionIds = measurements.map(m => m.definitionId);

        if (definitionIds.some(id => !id)) {
            throw new BadRequestException('Measurement definitionId cannot be empty');
        }

        const uniqueIds = new Set(definitionIds);
        if (uniqueIds.size !== definitionIds.length) {
            throw new BadRequestException('Duplicate measurement definitions in the same assessment are not allowed');
        }

        for (const m of measurements) {
            const hasNumeric = m.numericValue != null;
            const hasString = !!m.stringValue;

            if (!hasNumeric && !hasString) {
                throw new BadRequestException('Each measurement requires a numericValue or stringValue');
            }
            if (hasNumeric && hasString) {
                throw new BadRequestException('A measurement cannot have both numericValue and stringValue');
            }
            if (hasNumeric && !Number.isFinite(m.numericValue)) {
                throw new BadRequestException('numericValue must be a finite number (NaN/Infinity are not allowed)');
            }
        }
    }

    /** DB-backed catalog check -- accepts either the plain PrismaService or an interactive transaction's client, so it can run inside a lock. */
    private async assertDefinitionsUsable(client: PrismaClientOrTx, measurements: MeasurementRecordDto[]): Promise<void> {
        const definitionIds = measurements.map(m => m.definitionId);
        const existingDefinitions = await client.measurementDefinition.findMany({
            where: { id: { in: definitionIds }, isActive: true },
            select: { id: true },
        });

        if (existingDefinitions.length !== definitionIds.length) {
            const existingIds = existingDefinitions.map(d => d.id);
            const missingIds = definitionIds.filter(id => !existingIds.includes(id));
            throw new BadRequestException(`The following measurement definitions do not exist or are inactive: ${missingIds.join(', ')}`);
        }
    }

    /**
     * Takes a row-level PostgreSQL lock (SELECT ... FOR UPDATE) on the Assessment for the
     * duration of the enclosing transaction, combining ownership + DRAFT-state validation in
     * one atomic step. Any other upsert/remove/complete call for the same assessment blocks
     * until this transaction commits or rolls back, then re-reads the committed state -- this
     * is what actually prevents the "checked DRAFT, then someone else completed it" race.
     */
    private async lockDraftAssessment(tx: Prisma.TransactionClient, userId: string, patientId: string, assessmentId: string) {
        const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
            SELECT a.id, a.status
            FROM "Assessment" a
            JOIN "Patient" p ON p.id = a."patientId"
            WHERE a.id = ${assessmentId} AND a."patientId" = ${patientId} AND p."userId" = ${userId}
            FOR UPDATE OF a
        `;
        const assessment = rows[0];
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'DRAFT') throw new ConflictException('Assessment is no longer a DRAFT');
        return assessment;
    }

    // POST /patients/:id/assessments -- legacy one-shot creation, always COMPLETED, never a DRAFT.
    async create(userId: string, patientId: string, dto: CreateAssessmentDto) {
        this.validateMeasurementsShape(dto.measurements);
        await this.assertDefinitionsUsable(this.prisma, dto.measurements);

        const patient = await this.prisma.patient.findFirst({
            where: { id: patientId, userId },
        });

        if (!patient) {
            throw new NotFoundException('Patient not found');
        }

        const assessmentDate = new Date(dto.date);

        // 1. Resolve clinical context
        const context = this.contextResolver.resolveContext(patient, assessmentDate);

        // 2. Perform calculations dynamically early before persist
        const calculatedResults: EngineResult[] = this.engine.calculateAll(
            context,
            patient,
            dto.measurements
        );

        // 3. Persist the entire Assessment inside a transaction
        const newAssessment = await this.prisma.$transaction(async (tx) => {
            // Create Assessment Entity -- always COMPLETED; this endpoint never produces a DRAFT.
            const assessment = await tx.assessment.create({
                data: {
                    patientId,
                    date: assessmentDate,
                    status: AssessmentStatus.COMPLETED,
                    completedAt: new Date(),
                    ageAtAssessmentMonths: context.ageAtAssessmentMonths,
                    populationGroup: context.populationGroup,
                    specialProfile: context.specialProfile,
                    clinicalProtocol: context.clinicalProtocol,
                },
            });

            // Insert Measurements (Crudos)
            if (dto.measurements.length > 0) {
                await tx.measurementRecord.createMany({
                    data: dto.measurements.map(m => ({
                        assessmentId: assessment.id,
                        definitionId: m.definitionId,
                        numericValue: m.numericValue,
                        stringValue: m.stringValue,
                        metadataAsJson: m.metadataAsJson,
                        measuredBy: m.measuredBy,
                        deviceUsed: m.deviceUsed,
                    }))
                });
            }

            // Insert Calculated Results
            if (calculatedResults.length > 0) {
                await tx.calculatedResult.createMany({
                    data: calculatedResults.map(r => ({
                        assessmentId: assessment.id,
                        metricId: r.metricId,
                        numericValue: r.numericValue,
                        stringValue: r.stringValue,
                        metadataAsJson: r.metadataAsJson as any,
                        status: r.status,
                        statusCode: r.statusCode,
                        statusLabel: r.statusLabel,
                        formulaUsed: r.formulaUsed,
                        formulaVersion: r.formulaVersion,
                        referenceTableId: r.referenceTableId,
                        engineVersion: r.engineVersion,
                    }))
                });
            }

            return assessment;
        });

        return this.findOne(userId, newAssessment.id);
    }

    async findOne(userId: string, id: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: {
                id,
                patient: { userId },
            },
            include: {
                measurements: true,
                results: true,
            }
        });

        if (!assessment) throw new NotFoundException('Assessment not found');

        // Mapeo en vivo de UI en backend (Dumb Frontend paradigm)
        return this.mapToUiResponse(assessment);
    }

    /** Validates patientId + userId + assessmentId together, per this repo's ownership pattern (PlansService.verifyPlanOwnership). */
    async findOneForPatient(userId: string, patientId: string, assessmentId: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: { id: assessmentId, patientId, patient: { userId } },
            include: { measurements: true, results: true },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        return this.mapToUiResponse(assessment);
    }

    async findAllByPatient(userId: string, patientId: string, status?: AssessmentStatus) {
        const patient = await this.prisma.patient.findFirst({
            where: { id: patientId, userId },
            select: { id: true },
        });
        if (!patient) throw new NotFoundException('Patient not found');

        return this.prisma.assessment.findMany({
            where: { patientId, ...(status ? { status } : {}) },
            orderBy: { date: 'desc' },
            select: { id: true, date: true, status: true, populationGroup: true },
        });
    }

    async findLatestByPatient(userId: string, patientId: string) {
        const patient = await this.prisma.patient.findFirst({
            where: { id: patientId, userId },
            select: { id: true },
        });

        if (!patient) {
            throw new NotFoundException('Patient not found');
        }

        const assessment = await this.prisma.assessment.findFirst({
            where: {
                patientId,
            },
            orderBy: { date: 'desc' },
            include: {
                measurements: true,
                results: true,
            }
        });

        if (!assessment) return null;

        return this.mapToUiResponse(assessment);
    }

    // POST /patients/:patientId/assessments/draft -- crea o recupera el DRAFT activo del paciente
    async createOrGetDraft(userId: string, patientId: string, dto: CreateDraftDto) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId } });
        if (!patient) throw new NotFoundException('Patient not found');

        const existing = await this.prisma.assessment.findFirst({ where: { patientId, status: 'DRAFT' } });
        if (existing) return this.findOneForPatient(userId, patientId, existing.id);

        try {
            const created = await this.prisma.assessment.create({
                data: {
                    patientId,
                    date: dto.date ? new Date(dto.date) : new Date(),
                    status: 'DRAFT',
                },
            });
            return this.findOneForPatient(userId, patientId, created.id);
        } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                // Otra request ya creó el DRAFT (carrera con el índice único parcial de la BD).
                const winner = await this.prisma.assessment.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
                return this.findOneForPatient(userId, patientId, winner.id);
            }
            throw e;
        }
    }

    // PATCH /patients/:patientId/assessments/:assessmentId/measurements
    async upsertMeasurements(userId: string, patientId: string, assessmentId: string, dto: UpsertMeasurementsDto) {
        this.validateMeasurementsShape(dto.measurements);

        return this.prisma.$transaction(async (tx) => {
            await this.lockDraftAssessment(tx, userId, patientId, assessmentId);
            await this.assertDefinitionsUsable(tx, dto.measurements);

            for (const m of dto.measurements) {
                await tx.measurementRecord.upsert({
                    where: { assessmentId_definitionId: { assessmentId, definitionId: m.definitionId } },
                    create: {
                        assessmentId,
                        definitionId: m.definitionId,
                        numericValue: m.numericValue,
                        stringValue: m.stringValue,
                        metadataAsJson: m.metadataAsJson,
                        measuredBy: m.measuredBy,
                        deviceUsed: m.deviceUsed,
                    },
                    update: {
                        numericValue: m.numericValue,
                        stringValue: m.stringValue,
                        metadataAsJson: m.metadataAsJson,
                        measuredBy: m.measuredBy,
                        deviceUsed: m.deviceUsed,
                    },
                });
            }

            const assessment = await tx.assessment.findFirst({
                where: { id: assessmentId },
                include: { measurements: true, results: true },
            });
            return this.mapToUiResponse(assessment);
        });
    }

    // DELETE /patients/:patientId/assessments/:assessmentId/measurements/:definitionId
    async removeMeasurement(userId: string, patientId: string, assessmentId: string, definitionId: string) {
        return this.prisma.$transaction(async (tx) => {
            await this.lockDraftAssessment(tx, userId, patientId, assessmentId);

            const deleted = await tx.measurementRecord.deleteMany({ where: { assessmentId, definitionId } });
            if (deleted.count === 0) throw new NotFoundException('Measurement not found in this assessment');

            const assessment = await tx.assessment.findFirst({
                where: { id: assessmentId },
                include: { measurements: true, results: true },
            });
            return this.mapToUiResponse(assessment);
        });
    }

    // POST /patients/:patientId/assessments/:assessmentId/complete
    async complete(userId: string, patientId: string, assessmentId: string) {
        return this.prisma.$transaction(async (tx) => {
            await this.lockDraftAssessment(tx, userId, patientId, assessmentId);

            const assessment = await tx.assessment.findFirst({
                where: { id: assessmentId },
                include: { measurements: true },
            });
            if (!assessment) throw new NotFoundException('Assessment not found');
            if (assessment.measurements.length === 0) {
                throw new BadRequestException('At least one measurement is required to complete an assessment');
            }

            const patient = await tx.patient.findFirstOrThrow({ where: { id: patientId } });
            const context = this.contextResolver.resolveContext(patient, assessment.date);

            const measurementDtos: MeasurementRecordDto[] = assessment.measurements.map(m => ({
                definitionId: m.definitionId,
                numericValue: m.numericValue ?? undefined,
                stringValue: m.stringValue ?? undefined,
            }));
            const calculatedResults: EngineResult[] = this.engine.calculateAll(context, patient, measurementDtos);

            await tx.calculatedResult.deleteMany({ where: { assessmentId } });

            if (calculatedResults.length > 0) {
                await tx.calculatedResult.createMany({
                    data: calculatedResults.map(r => ({
                        assessmentId,
                        metricId: r.metricId,
                        numericValue: r.numericValue,
                        stringValue: r.stringValue,
                        metadataAsJson: r.metadataAsJson as any,
                        status: r.status,
                        statusCode: r.statusCode,
                        statusLabel: r.statusLabel,
                        formulaUsed: r.formulaUsed,
                        formulaVersion: r.formulaVersion,
                        referenceTableId: r.referenceTableId,
                        engineVersion: r.engineVersion,
                    })),
                });
            }

            // Defensive belt-and-suspenders: the FOR UPDATE lock already guarantees this can't
            // affect 0 rows in practice, but the conditional WHERE + count check makes the
            // invariant explicit and gives a concrete 409 path if that assumption is ever broken
            // by a future refactor.
            const updated = await tx.assessment.updateMany({
                where: { id: assessmentId, status: 'DRAFT' },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    ageAtAssessmentMonths: context.ageAtAssessmentMonths,
                    populationGroup: context.populationGroup,
                    specialProfile: context.specialProfile,
                    clinicalProtocol: context.clinicalProtocol,
                },
            });
            if (updated.count === 0) {
                throw new ConflictException('Assessment was already completed by another request');
            }

            const final = await tx.assessment.findFirst({
                where: { id: assessmentId },
                include: { measurements: true, results: true },
            });
            return this.mapToUiResponse(final);
        });
    }

    private mapToUiResponse(assessment: any) {
        // We map results to inject colors dynamically
        const resultsUi = assessment.results.map((r: any) => {
            let uiTone = 'neutral';

            // Mapeo básico UI
            if (r.statusCode === 'UNDERWEIGHT') uiTone = 'blue';
            else if (r.statusCode === 'NORMAL') uiTone = 'green';
            else if (r.statusCode === 'OVERWEIGHT') uiTone = 'orange';
            else if (r.statusCode === 'OBESE') uiTone = 'red';

            return {
                ...r,
                ui: {
                    uiTone: uiTone
                }
            };
        });

        return {
            ...assessment,
            results: resultsUi
        };
    }
}
