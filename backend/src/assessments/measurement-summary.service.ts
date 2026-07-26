import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type Trend = 'UP' | 'DOWN' | 'FLAT';

export interface MeasurementValue {
    assessmentId: string;
    recordId: string;
    value: number | string;
    date: Date;
}

@Injectable()
export class MeasurementSummaryService {
    constructor(private readonly prisma: PrismaService) { }

    async getSummary(userId: string, patientId: string) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId }, select: { id: true } });
        if (!patient) throw new NotFoundException('Patient not found');

        const [definitions, draftAssessment, completedAssessments] = await Promise.all([
            this.prisma.measurementDefinition.findMany({
                where: { isActive: true },
                orderBy: [{ group: 'asc' }, { name: 'asc' }],
            }),
            this.prisma.assessment.findFirst({
                where: { patientId, status: 'DRAFT' },
                include: { measurements: true },
            }),
            this.prisma.assessment.findMany({
                where: { patientId, status: 'COMPLETED' },
                orderBy: { date: 'desc' },
                include: { measurements: true },
            }),
        ]);

        const latestByDefinition = new Map<string, MeasurementValue>();
        const previousByDefinition = new Map<string, MeasurementValue>();

        for (const assessment of completedAssessments) {
            for (const m of assessment.measurements) {
                if (m.numericValue == null && !m.stringValue) continue;
                const value = m.numericValue ?? m.stringValue!;
                if (!latestByDefinition.has(m.definitionId)) {
                    latestByDefinition.set(m.definitionId, { assessmentId: assessment.id, recordId: m.id, value, date: assessment.date });
                } else if (!previousByDefinition.has(m.definitionId)) {
                    previousByDefinition.set(m.definitionId, { assessmentId: assessment.id, recordId: m.id, value, date: assessment.date });
                }
            }
        }

        const draftByDefinition = new Map<string, MeasurementValue>();
        if (draftAssessment) {
            for (const m of draftAssessment.measurements) {
                if (m.numericValue == null && !m.stringValue) continue;
                draftByDefinition.set(m.definitionId, {
                    assessmentId: draftAssessment.id,
                    recordId: m.id,
                    value: m.numericValue ?? m.stringValue!,
                    date: draftAssessment.date,
                });
            }
        }

        const cards = definitions.map(def => {
            const latest = latestByDefinition.get(def.id) ?? null;
            const previous = previousByDefinition.get(def.id) ?? null;
            const draft = draftByDefinition.get(def.id) ?? null;
            return {
                definitionId: def.id,
                group: def.group,
                name: def.name,
                unit: def.unit,
                draft,
                latestCompleted: latest,
                previousCompleted: previous,
                change: this.computeChange(latest, previous),
            };
        });

        return {
            patientId,
            activeDraft: draftAssessment
                ? {
                    id: draftAssessment.id,
                    date: draftAssessment.date,
                    status: draftAssessment.status,
                    measurementCount: draftAssessment.measurements.length,
                    updatedAt: draftAssessment.updatedAt,
                }
                : null,
            definitions,
            cards,
        };
    }

    async getHistory(userId: string, patientId: string, definitionId: string, page: number, pageSize: number) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId }, select: { id: true } });
        if (!patient) throw new NotFoundException('Patient not found');

        const definition = await this.prisma.measurementDefinition.findUnique({ where: { id: definitionId } });
        if (!definition) throw new NotFoundException('Measurement definition not found');

        const where = { definitionId, assessment: { patientId, status: 'COMPLETED' as const } };

        const [records, total] = await Promise.all([
            this.prisma.measurementRecord.findMany({
                where,
                include: { assessment: { select: { id: true, date: true } } },
                orderBy: { assessment: { date: 'desc' } },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.measurementRecord.count({ where }),
        ]);

        return {
            definition: { id: definition.id, name: definition.name, unit: definition.unit },
            data: records.map(r => ({
                recordId: r.id,
                assessmentId: r.assessment.id,
                value: r.numericValue ?? r.stringValue,
                date: r.assessment.date,
            })),
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    private computeChange(latest: MeasurementValue | null, previous: MeasurementValue | null): { difference: number; trend: Trend; fromDate: Date; toDate: Date } | null {
        if (!latest || !previous || typeof latest.value !== 'number' || typeof previous.value !== 'number') return null;
        const difference = parseFloat((latest.value - previous.value).toFixed(2));
        const trend: Trend = difference > 0 ? 'UP' : difference < 0 ? 'DOWN' : 'FLAT';
        return { difference, trend, fromDate: previous.date, toDate: latest.date };
    }
}
