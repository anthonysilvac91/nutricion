import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssessmentDto, MeasurementRecordDto } from './dto/create-assessment.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { UpsertMeasurementsDto } from './dto/upsert-measurements.dto';
import { ContextResolverService } from './context-resolver.service';
import { ClinicalCalculationEngineService, EngineResult } from './clinical-calculation-engine.service';
import { AssessmentStatus } from '@prisma/client';

@Injectable()
export class AssessmentsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly contextResolver: ContextResolverService,
        private readonly engine: ClinicalCalculationEngineService,
    ) { }

    /** Shared payload validation for create() and upsertMeasurements() -- never duplicate these rules. */
    private async validateMeasurementsPayload(measurements: MeasurementRecordDto[]): Promise<void> {
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

        if (measurements.some(m => m.numericValue == null && !m.stringValue)) {
            throw new BadRequestException('Each measurement requires a numericValue or stringValue');
        }

        const existingDefinitions = await this.prisma.measurementDefinition.findMany({
            where: { id: { in: definitionIds } },
            select: { id: true }
        });

        if (existingDefinitions.length !== definitionIds.length) {
            const existingIds = existingDefinitions.map(d => d.id);
            const missingIds = definitionIds.filter(id => !existingIds.includes(id));
            throw new BadRequestException(`The following measurement definitions do not exist: ${missingIds.join(', ')}`);
        }
    }

    async create(userId: string, patientId: string, dto: CreateAssessmentDto) {
        await this.validateMeasurementsPayload(dto.measurements);

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
            // Create Assessment Entity
            const assessment = await tx.assessment.create({
                data: {
                    patientId,
                    date: assessmentDate,
                    status: dto.status || AssessmentStatus.DRAFT,
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

    private async verifyDraftOwnership(userId: string, patientId: string, assessmentId: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: { id: assessmentId, patientId, patient: { userId } },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'DRAFT') {
            throw new BadRequestException('Only a DRAFT assessment can be modified');
        }
        return assessment;
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
                // Otra request ya creó el DRAFT (carrera con el índice único parcial).
                const winner = await this.prisma.assessment.findFirstOrThrow({ where: { patientId, status: 'DRAFT' } });
                return this.findOneForPatient(userId, patientId, winner.id);
            }
            throw e;
        }
    }

    // PATCH /patients/:patientId/assessments/:assessmentId/measurements
    async upsertMeasurements(userId: string, patientId: string, assessmentId: string, dto: UpsertMeasurementsDto) {
        await this.verifyDraftOwnership(userId, patientId, assessmentId);
        await this.validateMeasurementsPayload(dto.measurements);

        await this.prisma.$transaction(
            dto.measurements.map(m => this.prisma.measurementRecord.upsert({
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
            }))
        );

        return this.findOneForPatient(userId, patientId, assessmentId);
    }

    // DELETE /patients/:patientId/assessments/:assessmentId/measurements/:definitionId
    async removeMeasurement(userId: string, patientId: string, assessmentId: string, definitionId: string) {
        await this.verifyDraftOwnership(userId, patientId, assessmentId);

        const deleted = await this.prisma.measurementRecord.deleteMany({ where: { assessmentId, definitionId } });
        if (deleted.count === 0) throw new NotFoundException('Measurement not found in this assessment');

        return this.findOneForPatient(userId, patientId, assessmentId);
    }

    // POST /patients/:patientId/assessments/:assessmentId/complete
    async complete(userId: string, patientId: string, assessmentId: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: { id: assessmentId, patientId, patient: { userId } },
            include: { measurements: true },
        });
        if (!assessment) throw new NotFoundException('Assessment not found');
        if (assessment.status !== 'DRAFT') throw new BadRequestException('Only a DRAFT assessment can be completed');
        if (assessment.measurements.length === 0) {
            throw new BadRequestException('At least one measurement is required to complete an assessment');
        }

        const patient = await this.prisma.patient.findFirstOrThrow({ where: { id: patientId } });
        const context = this.contextResolver.resolveContext(patient, assessment.date);

        const measurementDtos: MeasurementRecordDto[] = assessment.measurements.map(m => ({
            definitionId: m.definitionId,
            numericValue: m.numericValue ?? undefined,
            stringValue: m.stringValue ?? undefined,
        }));
        const calculatedResults: EngineResult[] = this.engine.calculateAll(context, patient, measurementDtos);

        await this.prisma.$transaction(async (tx) => {
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

            await tx.assessment.update({
                where: { id: assessmentId },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    ageAtAssessmentMonths: context.ageAtAssessmentMonths,
                    populationGroup: context.populationGroup,
                    specialProfile: context.specialProfile,
                    clinicalProtocol: context.clinicalProtocol,
                },
            });
        });

        return this.findOneForPatient(userId, patientId, assessmentId);
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
