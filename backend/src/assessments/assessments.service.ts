import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
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

    async create(patientId: string, dto: CreateAssessmentDto) {
        const patient = await this.prisma.patient.findUnique({
            where: { id: patientId },
        });

        if (!patient) {
            throw new NotFoundException('Patient not found');
        }

        const assessmentDate = new Date(dto.date);

        // 1. Resolve clinical context
        const context = this.contextResolver.resolveContext(patient, assessmentDate);

        // 2. Perform calculations dynamically early before persist
        const calculatedResults: EngineResult[] = await this.engine.calculateAll(
            context,
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
                        metadataAsJson: r.metadataAsJson,
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

        return this.findOne(newAssessment.id);
    }

    async findOne(id: string) {
        const assessment = await this.prisma.assessment.findUnique({
            where: { id },
            include: {
                measurements: true,
                results: true,
            }
        });

        if (!assessment) throw new NotFoundException('Assessment not found');

        // Mapeo en vivo de UI en backend (Dumb Frontend paradigm)
        return this.mapToUiResponse(assessment);
    }

    async findLatestByPatient(patientId: string) {
        const assessment = await this.prisma.assessment.findFirst({
            where: { patientId },
            orderBy: { date: 'desc' },
            include: {
                measurements: true,
                results: true,
            }
        });

        if (!assessment) return null;

        return this.mapToUiResponse(assessment);
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
