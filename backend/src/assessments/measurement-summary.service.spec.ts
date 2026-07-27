import { NotFoundException } from '@nestjs/common';
import { MeasurementSummaryService } from './measurement-summary.service';

function buildPrismaMock() {
    return {
        patient: { findFirst: jest.fn() },
        measurementDefinition: { findMany: jest.fn(), findUnique: jest.fn() },
        assessment: { findFirst: jest.fn() },
        measurementRecord: { findMany: jest.fn(), count: jest.fn() },
        // getSummary reads the ranked latest/previous values via a single window-function
        // query instead of loading every COMPLETED assessment -- tests supply already-ranked
        // rows here, exactly as PostgreSQL's ROW_NUMBER() would return them.
        $queryRaw: jest.fn(),
    };
}

describe('MeasurementSummaryService', () => {
    let prisma: ReturnType<typeof buildPrismaMock>;
    let service: MeasurementSummaryService;

    beforeEach(() => {
        prisma = buildPrismaMock();
        service = new MeasurementSummaryService(prisma as any);
    });

    describe('getSummary', () => {
        it('throws NotFoundException when the patient is not owned by the user', async () => {
            prisma.patient.findFirst.mockResolvedValue(null);
            await expect(service.getSummary('user-1', 'patient-1')).rejects.toThrow(NotFoundException);
        });

        it('computes latestCompleted/previousCompleted/change from COMPLETED assessments only, and draft separately', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.measurementDefinition.findMany.mockResolvedValue([
                { id: 'm_weight', group: 'BASIC', name: 'Peso', unit: 'kg' },
                { id: 'm_height', group: 'BASIC', name: 'Estatura', unit: 'cm' },
            ]);
            prisma.assessment.findFirst.mockResolvedValue({
                id: 'draft-1',
                date: new Date('2026-07-26'),
                status: 'DRAFT',
                updatedAt: new Date('2026-07-26'),
                measurements: [{ id: 'rec-draft-weight', definitionId: 'm_weight', numericValue: 68, stringValue: null }],
            });
            // Rows already ranked by the SQL window function: rn=1 is the most recent,
            // rn=2 the one before it -- exactly the shape ROW_NUMBER() OVER (...) produces.
            prisma.$queryRaw.mockResolvedValue([
                { recordId: 'rec-jan', assessmentId: 'assessment-jan', definitionId: 'm_weight', numericValue: 70, stringValue: null, date: new Date('2026-01-01'), rn: 1n },
                { recordId: 'rec-dec', assessmentId: 'assessment-dec', definitionId: 'm_weight', numericValue: 72, stringValue: null, date: new Date('2025-12-01'), rn: 2n },
            ]);

            const summary = await service.getSummary('user-1', 'patient-1');

            expect(summary.activeDraft).toEqual(expect.objectContaining({ id: 'draft-1', measurementCount: 1 }));

            const weightCard = summary.cards.find(c => c.definitionId === 'm_weight')!;
            expect(weightCard.draft).toEqual(expect.objectContaining({ value: 68 }));
            expect(weightCard.latestCompleted).toEqual(expect.objectContaining({ value: 70, assessmentId: 'assessment-jan' }));
            expect(weightCard.previousCompleted).toEqual(expect.objectContaining({ value: 72, assessmentId: 'assessment-dec' }));
            expect(weightCard.change).toEqual({
                difference: -2,
                trend: 'DOWN',
                fromDate: '2025-12-01',
                toDate: '2026-01-01',
            });

            // Height was never measured at all -- everything must be null, not fabricated.
            const heightCard = summary.cards.find(c => c.definitionId === 'm_height')!;
            expect(heightCard.draft).toBeNull();
            expect(heightCard.latestCompleted).toBeNull();
            expect(heightCard.previousCompleted).toBeNull();
            expect(heightCard.change).toBeNull();
        });

        it('leaves change null when there is only one completed value', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight', group: 'BASIC', name: 'Peso', unit: 'kg' }]);
            prisma.assessment.findFirst.mockResolvedValue(null);
            prisma.$queryRaw.mockResolvedValue([
                { recordId: 'r1', assessmentId: 'a1', definitionId: 'm_weight', numericValue: 70, stringValue: null, date: new Date('2026-01-01'), rn: 1n },
            ]);

            const summary = await service.getSummary('user-1', 'patient-1');
            expect(summary.activeDraft).toBeNull();
            const card = summary.cards[0];
            expect(card.latestCompleted).toEqual(expect.objectContaining({ value: 70 }));
            expect(card.previousCompleted).toBeNull();
            expect(card.change).toBeNull();
        });

        it('only ever treats rn=1 as latest and rn=2 as previous, ignoring any further rank (defense in depth vs. the SQL WHERE rn<=2 clause)', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.measurementDefinition.findMany.mockResolvedValue([{ id: 'm_weight', group: 'BASIC', name: 'Peso', unit: 'kg' }]);
            prisma.assessment.findFirst.mockResolvedValue(null);
            prisma.$queryRaw.mockResolvedValue([
                { recordId: 'r3', assessmentId: 'a3', definitionId: 'm_weight', numericValue: 74, stringValue: null, date: new Date('2026-02-01'), rn: 1n },
                { recordId: 'r2', assessmentId: 'a2', definitionId: 'm_weight', numericValue: 72, stringValue: null, date: new Date('2026-01-01'), rn: 2n },
                { recordId: 'r1', assessmentId: 'a1', definitionId: 'm_weight', numericValue: 70, stringValue: null, date: new Date('2025-12-01'), rn: 3n },
            ]);

            const summary = await service.getSummary('user-1', 'patient-1');
            const card = summary.cards[0];
            expect(card.latestCompleted).toEqual(expect.objectContaining({ value: 74, assessmentId: 'a3' }));
            expect(card.previousCompleted).toEqual(expect.objectContaining({ value: 72, assessmentId: 'a2' }));
            // The 3rd-ranked row must never surface anywhere in the response.
            expect(JSON.stringify(summary)).not.toContain('a1');
        });
    });

    describe('getHistory', () => {
        it('throws NotFoundException when the patient is not owned', async () => {
            prisma.patient.findFirst.mockResolvedValue(null);
            await expect(service.getHistory('user-1', 'patient-1', 'm_weight', 1, 20)).rejects.toThrow(NotFoundException);
        });

        it('throws NotFoundException when the definition does not exist', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.measurementDefinition.findUnique.mockResolvedValue(null);
            await expect(service.getHistory('user-1', 'patient-1', 'does_not_exist', 1, 20)).rejects.toThrow(NotFoundException);
        });

        it('returns paginated, descending-ordered history scoped to COMPLETED assessments', async () => {
            prisma.patient.findFirst.mockResolvedValue({ id: 'patient-1' });
            prisma.measurementDefinition.findUnique.mockResolvedValue({ id: 'm_weight', name: 'Peso', unit: 'kg' });
            prisma.measurementRecord.findMany.mockResolvedValue([
                { id: 'r2', numericValue: 70, stringValue: null, assessment: { id: 'a2', date: new Date('2026-01-01') } },
                { id: 'r1', numericValue: 72, stringValue: null, assessment: { id: 'a1', date: new Date('2025-12-01') } },
            ]);
            prisma.measurementRecord.count.mockResolvedValue(2);

            const history = await service.getHistory('user-1', 'patient-1', 'm_weight', 1, 20);

            expect(prisma.measurementRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { definitionId: 'm_weight', assessment: { patientId: 'patient-1', status: 'COMPLETED' } },
                orderBy: [
                    { assessment: { date: 'desc' } },
                    { assessment: { completedAt: 'desc' } },
                    { createdAt: 'desc' },
                    { id: 'desc' },
                ],
                skip: 0,
                take: 20,
            }));
            expect(history.data).toEqual([
                { recordId: 'r2', assessmentId: 'a2', value: 70, date: '2026-01-01' },
                { recordId: 'r1', assessmentId: 'a1', value: 72, date: '2025-12-01' },
            ]);
            expect(history.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
        });
    });
});
