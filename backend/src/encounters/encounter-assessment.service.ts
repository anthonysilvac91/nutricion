import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { ContextResolverService } from '../assessments/context-resolver.service';
import { ClinicalCalculationEngineService, EngineResult } from '../assessments/clinical-calculation-engine.service';
import { UpsertMeasurementsDto } from '../assessments/dto/upsert-measurements.dto';
import { MeasurementRecordDto } from '../assessments/dto/create-assessment.dto';
import { EncountersService } from './encounters.service';

/**
 * Assessment encounter-scoped: el Assessment de UNA consulta clínica concreta.
 * Autorización exclusivamente por WorkspaceMember (nunca Patient.userId) --
 * ver EncountersService.lockEncounterForWrite. Toda la lógica clínica
 * (validación de forma, catálogo, ContextResolver, motor de cálculo,
 * construcción de CalculatedResult, shape de respuesta) se reutiliza tal cual
 * de AssessmentsService -- esta clase nunca duplica esa autoridad, solo
 * decide CUÁNDO invocarla y bajo qué lock.
 */
@Injectable()
export class EncounterAssessmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encounters: EncountersService,
    private readonly assessments: AssessmentsService,
    private readonly contextResolver: ContextResolverService,
    private readonly engine: ClinicalCalculationEngineService,
  ) {}

  /**
   * Lock de Encounter + Assessment asociado, en ese orden (ver
   * EncountersService.lockEncounterForWrite para el orden estable de locks).
   * Exige Encounter IN_PROGRESS -- ninguna mutación de mediciones procede
   * sobre una consulta DISCARDED o (en cortes futuros) COMPLETED.
   */
  private async lockEncounterAndAssessment(tx: Prisma.TransactionClient, userId: string, patientId: string, encounterId: string) {
    const encounter = await this.encounters.lockEncounterForWrite(tx, userId, patientId, encounterId);
    if (encounter.status !== 'IN_PROGRESS') {
      throw new ConflictException({
        code: 'ENCOUNTER_NOT_IN_PROGRESS',
        message: 'La consulta ya no está en curso.',
      });
    }

    const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT a.id, a.status FROM "Assessment" a WHERE a."encounterId" = ${encounterId} FOR UPDATE OF a
    `;
    const assessment = rows[0];
    if (!assessment) throw new NotFoundException('Assessment not found');
    return { encounter, assessment };
  }

  // POST /patients/:patientId/encounters/:encounterId/assessment -- create or get, idempotente
  async createOrGet(userId: string, patientId: string, encounterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const encounter = await this.encounters.lockEncounterForWrite(tx, userId, patientId, encounterId);
      if (encounter.status !== 'IN_PROGRESS') {
        throw new ConflictException({
          code: 'ENCOUNTER_NOT_IN_PROGRESS',
          message: 'La consulta ya no está en curso.',
        });
      }

      // 1) Ya existe un Assessment para ESTA consulta -> idempotente, se devuelve.
      const existing = await tx.assessment.findUnique({
        where: { encounterId },
        include: { measurements: true, results: true },
      });
      if (existing) return this.assessments.mapToUiResponse(existing);

      // 2) DRAFT standalone del paciente (sin consulta) -> nunca se adopta en
      // silencio: la asociación clínica debe ser explícita, no inferida por
      // compartir patientId.
      const standaloneDraft = await tx.assessment.findFirst({
        where: { patientId, status: 'DRAFT', encounterId: null },
        select: { id: true },
      });
      if (standaloneDraft) {
        throw new ConflictException({
          code: 'PATIENT_HAS_UNLINKED_DRAFT_ASSESSMENT',
          message: 'El paciente tiene un borrador de evaluación sin vincular a ninguna consulta.',
        });
      }

      // 3) DRAFT ligado a OTRA consulta -> tampoco se reasigna nunca.
      const otherEncounterDraft = await tx.assessment.findFirst({
        where: { patientId, status: 'DRAFT', NOT: { encounterId: null } },
        select: { id: true },
      });
      if (otherEncounterDraft) {
        throw new ConflictException({
          code: 'PATIENT_HAS_OTHER_DRAFT_ASSESSMENT',
          message: 'El paciente tiene un borrador de evaluación activo en otra consulta.',
        });
      }

      // Idempotencia bajo concurrencia: el lock FOR UPDATE de ClinicalEncounter ya
      // serializa dos requests contra el mismo encounterId (la segunda espera a
      // que la primera confirme, y en ese punto `existing` ya la encuentra) --
      // el catch de P2002 es defensa adicional, mismo patrón que
      // AssessmentsService.createOrGetDraft.
      try {
        const created = await tx.assessment.create({
          data: {
            patientId,
            encounterId,
            // La fecha viene exclusivamente de la consulta -- nunca del cliente
            // ni de new Date(). Reutiliza el mismo valor ya canonicalizado
            // (anclado a 12:00 UTC) que ClinicalEncounter.clinicalDate.
            date: encounter.clinicalDate,
            status: 'DRAFT',
          },
        });

        await this.encounters.reconcileMeasurementsModule(tx, encounterId, 'IN_PROGRESS', null);

        const full = await tx.assessment.findUniqueOrThrow({
          where: { id: created.id },
          include: { measurements: true, results: true },
        });
        return this.assessments.mapToUiResponse(full);
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          const winner = await tx.assessment.findUniqueOrThrow({
            where: { encounterId },
            include: { measurements: true, results: true },
          });
          return this.assessments.mapToUiResponse(winner);
        }
        throw e;
      }
    });
  }

  // GET /patients/:patientId/encounters/:encounterId/assessment
  async findOne(userId: string, patientId: string, encounterId: string) {
    const encounter = await this.prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        workspace: { members: { some: { userId } } },
      },
      include: { assessment: { include: { measurements: true, results: true } } },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');
    if (!encounter.assessment) throw new NotFoundException('Assessment not found');

    return this.assessments.mapToUiResponse(encounter.assessment);
  }

  // PATCH /patients/:patientId/encounters/:encounterId/assessment/measurements
  async upsertMeasurements(userId: string, patientId: string, encounterId: string, dto: UpsertMeasurementsDto) {
    this.assessments.validateMeasurementsShape(dto.measurements);

    return this.prisma.$transaction(async (tx) => {
      const { assessment } = await this.lockEncounterAndAssessment(tx, userId, patientId, encounterId);
      if (assessment.status !== 'DRAFT') {
        throw new ConflictException({ code: 'ASSESSMENT_NOT_DRAFT', message: 'La evaluación de esta consulta ya no es un borrador.' });
      }
      await this.assessments.assertDefinitionsUsable(tx, dto.measurements);

      for (const m of dto.measurements) {
        await tx.measurementRecord.upsert({
          where: { assessmentId_definitionId: { assessmentId: assessment.id, definitionId: m.definitionId } },
          create: {
            assessmentId: assessment.id,
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

      const full = await tx.assessment.findUniqueOrThrow({
        where: { id: assessment.id },
        include: { measurements: true, results: true },
      });
      return this.assessments.mapToUiResponse(full);
    });
  }

  // DELETE /patients/:patientId/encounters/:encounterId/assessment/measurements/:definitionId
  async removeMeasurement(userId: string, patientId: string, encounterId: string, definitionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { assessment } = await this.lockEncounterAndAssessment(tx, userId, patientId, encounterId);
      if (assessment.status !== 'DRAFT') {
        throw new ConflictException({ code: 'ASSESSMENT_NOT_DRAFT', message: 'La evaluación de esta consulta ya no es un borrador.' });
      }

      const deleted = await tx.measurementRecord.deleteMany({ where: { assessmentId: assessment.id, definitionId } });
      if (deleted.count === 0) throw new NotFoundException('Measurement not found in this assessment');

      const full = await tx.assessment.findUniqueOrThrow({
        where: { id: assessment.id },
        include: { measurements: true, results: true },
      });
      return this.assessments.mapToUiResponse(full);
    });
  }

  // POST /patients/:patientId/encounters/:encounterId/assessment/complete
  async complete(userId: string, patientId: string, encounterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { assessment } = await this.lockEncounterAndAssessment(tx, userId, patientId, encounterId);
      if (assessment.status !== 'DRAFT') {
        throw new ConflictException({ code: 'ASSESSMENT_NOT_DRAFT', message: 'La evaluación de esta consulta ya no es un borrador.' });
      }

      const full = await tx.assessment.findFirstOrThrow({
        where: { id: assessment.id },
        include: { measurements: true },
      });
      if (full.measurements.length === 0) {
        throw new BadRequestException('At least one measurement is required to complete an assessment');
      }

      const patient = await tx.patient.findFirstOrThrow({ where: { id: patientId } });
      const context = this.contextResolver.resolveContext(patient, full.date);

      const measurementDtos: MeasurementRecordDto[] = full.measurements.map((m) => ({
        definitionId: m.definitionId,
        numericValue: m.numericValue ?? undefined,
        stringValue: m.stringValue ?? undefined,
      }));
      const calculatedResults: EngineResult[] = this.engine.calculateAll(context, patient, measurementDtos);

      await tx.calculatedResult.deleteMany({ where: { assessmentId: assessment.id } });
      if (calculatedResults.length > 0) {
        await tx.calculatedResult.createMany({
          data: this.assessments.buildCalculatedResultRows(assessment.id, calculatedResults),
        });
      }

      // Único timestamp lógico de finalización, compartido entre Assessment y
      // EncounterModuleState -- nunca deben divergir por una operación normal.
      const completedAt = new Date();

      // Defensive belt-and-suspenders: el lock FOR UPDATE ya garantiza que esto
      // no puede afectar 0 filas en la práctica (mismo patrón que
      // AssessmentsService.complete()/PlansService.finalize()).
      const updated = await tx.assessment.updateMany({
        where: { id: assessment.id, status: 'DRAFT' },
        data: {
          status: 'COMPLETED',
          completedAt,
          ageAtAssessmentMonths: context.ageAtAssessmentMonths,
          populationGroup: context.populationGroup,
          specialProfile: context.specialProfile,
          clinicalProtocol: context.clinicalProtocol,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException('Assessment was already completed by another request');
      }

      // Assessment es la autoridad clínica; EncounterModuleState solo se
      // reconcilia DESPUÉS de que el Assessment quedó COMPLETED de forma
      // efectiva -- nunca al revés. Ambos ocurren en la misma transacción:
      // si cualquier paso posterior fallara, todo se revierte junto.
      await this.encounters.reconcileMeasurementsModule(tx, encounterId, 'COMPLETED', completedAt);

      const finalAssessment = await tx.assessment.findFirstOrThrow({
        where: { id: assessment.id },
        include: { measurements: true, results: true },
      });
      return this.assessments.mapToUiResponse(finalAssessment);
    });
  }
}
