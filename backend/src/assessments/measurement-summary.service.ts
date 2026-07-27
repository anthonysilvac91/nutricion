import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatClinicalDate } from '../common/clinical-date.util';

export type Trend = 'UP' | 'DOWN' | 'FLAT';

export interface MeasurementValue {
    assessmentId: string;
    recordId: string;
    value: number | string;
    date: string;
}

interface RankedMeasurementRow {
    recordId: string;
    assessmentId: string;
    definitionId: string;
    numericValue: number | null;
    stringValue: string | null;
    date: Date;
    rn: bigint;
}

@Injectable()
export class MeasurementSummaryService {
    constructor(private readonly prisma: PrismaService) { }

    async getSummary(userId: string, patientId: string) {
        const patient = await this.prisma.patient.findFirst({ where: { id: patientId, userId }, select: { id: true } });
        if (!patient) throw new NotFoundException('Patient not found');

        const [definitions, draftAssessment, ranked] = await Promise.all([
            this.prisma.measurementDefinition.findMany({
                where: { isActive: true },
                orderBy: [{ group: 'asc' }, { name: 'asc' }],
            }),
            this.prisma.assessment.findFirst({
                where: { patientId, status: 'DRAFT' },
                include: { measurements: true },
            }),
            // Solo trae, por tipo de medición, las 2 filas más recientes entre TODAS las
            // evaluaciones COMPLETED del paciente -- nunca carga el historial completo,
            // sin importar cuántas evaluaciones tenga acumuladas.
            this.prisma.$queryRaw<RankedMeasurementRow[]>`
                SELECT * FROM (
                    SELECT
                        mr.id AS "recordId",
                        mr."assessmentId" AS "assessmentId",
                        mr."definitionId" AS "definitionId",
                        mr."numericValue" AS "numericValue",
                        mr."stringValue" AS "stringValue",
                        a.date AS "date",
                        ROW_NUMBER() OVER (
                            PARTITION BY mr."definitionId"
                            ORDER BY a.date DESC, a."completedAt" DESC NULLS LAST, mr."createdAt" DESC, mr.id DESC
                        ) AS rn
                    FROM "MeasurementRecord" mr
                    JOIN "Assessment" a ON a.id = mr."assessmentId"
                    WHERE a."patientId" = ${patientId}
                        AND a.status = 'COMPLETED'
                        AND (mr."numericValue" IS NOT NULL OR mr."stringValue" IS NOT NULL)
                ) ranked
                WHERE rn <= 2
            `,
        ]);

        const latestByDefinition = new Map<string, MeasurementValue>();
        const previousByDefinition = new Map<string, MeasurementValue>();

        for (const row of ranked) {
            const value = row.numericValue ?? row.stringValue!;
            const entry: MeasurementValue = { assessmentId: row.assessmentId, recordId: row.recordId, value, date: formatClinicalDate(row.date) };
            const rank = Number(row.rn);
            if (rank === 1) latestByDefinition.set(row.definitionId, entry);
            else if (rank === 2) previousByDefinition.set(row.definitionId, entry);
            // Any rank beyond 2 is ignored -- the SQL already filters with WHERE rn <= 2, this
            // is defense in depth so a bug in that clause can never leak a 3rd value here.
        }

        const draftByDefinition = new Map<string, MeasurementValue>();
        if (draftAssessment) {
            for (const m of draftAssessment.measurements) {
                if (m.numericValue == null && !m.stringValue) continue;
                draftByDefinition.set(m.definitionId, {
                    assessmentId: draftAssessment.id,
                    recordId: m.id,
                    value: m.numericValue ?? m.stringValue!,
                    date: formatClinicalDate(draftAssessment.date),
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
                    date: formatClinicalDate(draftAssessment.date),
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
                orderBy: [
                    { assessment: { date: 'desc' } },
                    { assessment: { completedAt: { sort: 'desc', nulls: 'last' } } },
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
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
                date: formatClinicalDate(r.assessment.date),
            })),
            meta: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
        };
    }

    private computeChange(latest: MeasurementValue | null, previous: MeasurementValue | null): { difference: number; trend: Trend; fromDate: string; toDate: string } | null {
        if (!latest || !previous || typeof latest.value !== 'number' || typeof previous.value !== 'number') return null;
        const difference = parseFloat((latest.value - previous.value).toFixed(2));
        const trend: Trend = difference > 0 ? 'UP' : difference < 0 ? 'DOWN' : 'FLAT';
        return { difference, trend, fromDate: previous.date, toDate: latest.date };
    }
}
