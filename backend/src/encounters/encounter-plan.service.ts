import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EncounterModule, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService, ENGINE_VERSION } from '../plans/plans.service';
import { AssessmentSnapshot, PlanCalculationService } from '../plans/plan-calculation.service';
import { RecalculatePlanDto } from '../plans/dto/recalculate-plan.dto';
import { EncountersService } from './encounters.service';

/**
 * NutritionalPlan encounter-scoped: el plan de UNA consulta clínica concreta.
 * Autorización exclusivamente por WorkspaceMember (nunca Patient.userId) --
 * ver EncountersService.lockEncounterForWrite. Toda la lógica clínica
 * (snapshot v2, inputs por defecto, motor de cálculo, evaluateFinalizationReadiness,
 * shape de respuesta) se reutiliza tal cual de PlansService/PlanCalculationService --
 * esta clase nunca duplica esa autoridad, solo decide CUÁNDO invocarla y bajo qué lock.
 *
 * NutritionalPlan sigue siendo la autoridad clínica de Planificación;
 * EncounterModuleState.PLANNING es únicamente una proyección de progreso (ver
 * EncountersService.reconcilePlanningModule). PLANNING = COMPLETED significa
 * "el plan asociado fue FINALIZED con las reglas/capacidades disponibles en esta
 * versión", nunca "todos los cálculos futuros de Equilio están implementados" --
 * evaluateFinalizationReadiness() sigue siendo la única autoridad para decidir si
 * ESTE plan puede finalizar.
 */
@Injectable()
export class EncounterPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encounters: EncountersService,
    private readonly plans: PlansService,
    private readonly planCalculation: PlanCalculationService,
  ) {}

  /**
   * Lock de Encounter + NutritionalPlan asociado, en ese orden (ver
   * EncountersService.lockEncounterForWrite para el orden estable de locks:
   * 1) ClinicalEncounter, 2) NutritionalPlan -- nunca al revés, para no
   * exponernos a deadlocks entre distintas operaciones concurrentes).
   * Exige Encounter IN_PROGRESS -- ninguna mutación del plan procede sobre
   * una consulta DISCARDED o (en cortes futuros) COMPLETED.
   */
  private async lockEncounterAndPlan(tx: Prisma.TransactionClient, userId: string, patientId: string, encounterId: string) {
    const encounter = await this.encounters.lockEncounterForWrite(tx, userId, patientId, encounterId);
    if (encounter.status !== 'IN_PROGRESS') {
      throw new ConflictException({
        code: 'ENCOUNTER_NOT_IN_PROGRESS',
        message: 'La consulta ya no está en curso.',
      });
    }

    const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT p.id, p.status FROM "NutritionalPlan" p WHERE p."encounterId" = ${encounterId} FOR UPDATE OF p
    `;
    const plan = rows[0];
    if (!plan) throw new NotFoundException('Plan not found');
    return { encounter, plan };
  }

  // POST /patients/:patientId/encounters/:encounterId/plan -- create or get, idempotente
  async createOrGet(userId: string, patientId: string, encounterId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const encounter = await this.encounters.lockEncounterForWrite(tx, userId, patientId, encounterId);
        if (encounter.status !== 'IN_PROGRESS') {
          throw new ConflictException({
            code: 'ENCOUNTER_NOT_IN_PROGRESS',
            message: 'La consulta ya no está en curso.',
          });
        }

        // PLANNING debe ser aplicable para el perfil de esta consulta -- la
        // única autoridad de applicability es ClinicalEncounter +
        // EncounterModuleState, nunca Assessment.populationGroup (ver
        // EncountersService.requireModuleApplicable). En PEDIATRIC (foundation-v1)
        // esto rechaza la creación con 409 ENCOUNTER_MODULE_NOT_APPLICABLE.
        await this.encounters.requireModuleApplicable(tx, encounterId, EncounterModule.PLANNING);

        // 1) Ya existe un Plan para ESTE encounter -> idempotente, se devuelve.
        const existingPlan = await tx.nutritionalPlan.findUnique({ where: { encounterId } });
        if (existingPlan) return this.plans.mapToDto(existingPlan);

        // 2) El Assessment fuente sale EXCLUSIVAMENTE de encounter.assessment --
        // nunca del último Assessment COMPLETED del paciente, nunca de un
        // assessmentId enviado por el cliente (esta ruta no acepta body).
        const assessmentRow = await tx.assessment.findUnique({
          where: { encounterId },
          select: { id: true, status: true },
        });
        if (!assessmentRow) {
          throw new ConflictException({
            code: 'ENCOUNTER_ASSESSMENT_REQUIRED',
            message: 'La consulta no tiene una evaluación asociada; complétala antes de planificar.',
          });
        }
        if (assessmentRow.status !== 'COMPLETED') {
          throw new ConflictException({
            code: 'ENCOUNTER_ASSESSMENT_NOT_COMPLETED',
            message: 'La evaluación de esta consulta debe estar completada antes de planificar.',
          });
        }

        // 3) DRAFT standalone del paciente (sin consulta) -> nunca se adopta en
        // silencio: la asociación clínica debe ser explícita, no inferida por
        // compartir patientId.
        const standaloneDraft = await tx.nutritionalPlan.findFirst({
          where: { patientId, status: 'DRAFT', encounterId: null },
          select: { id: true },
        });
        if (standaloneDraft) {
          throw new ConflictException({
            code: 'PATIENT_HAS_UNLINKED_DRAFT_PLAN',
            message: 'El paciente tiene un plan en borrador sin vincular a ninguna consulta.',
          });
        }

        // 4) DRAFT ligado a OTRA consulta -> tampoco se reasigna nunca.
        const otherEncounterDraft = await tx.nutritionalPlan.findFirst({
          where: { patientId, status: 'DRAFT', NOT: { encounterId: null } },
          select: { id: true },
        });
        if (otherEncounterDraft) {
          throw new ConflictException({
            code: 'PATIENT_HAS_OTHER_DRAFT_PLAN',
            message: 'El paciente tiene un plan en borrador activo en otra consulta.',
          });
        }

        // Construcción del plan inicial -- reutiliza tal cual la autoridad clínica
        // de PlansService/PlanCalculationService (snapshot v2, inputs por
        // defecto, motor de cálculo, metadata), nunca una segunda implementación.
        const patient = await tx.patient.findFirstOrThrow({ where: { id: patientId } });
        const assessment = await this.plans.loadCompletedAssessment(tx, patientId, assessmentRow.id);
        if ((assessment.populationGroup ?? 'ADULT') !== 'ADULT') {
          // Validación clínica existente de PlansService, preservada tal cual --
          // PEDIATRIC ya fue rechazado arriba por applicability, pero esto cubre
          // cualquier Assessment con populationGroup no-ADULT bajo un perfil que
          // sí tenga PLANNING=REQUIRED.
          throw new BadRequestException('Planificación solo está disponible para Adulto General en este momento.');
        }
        const snapshot = this.plans.buildSnapshotV2(assessment, patient);
        const config = this.plans.defaultPlanInputs(patient, snapshot);
        const calculationResults = this.planCalculation.calculate(snapshot, config);
        const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, config);

        // Idempotencia bajo concurrencia: el lock FOR UPDATE de ClinicalEncounter ya
        // serializa dos requests contra ESTE MISMO encounterId. El índice único que
        // puede saltar aquí es "un DRAFT por paciente" (NutritionalPlan_one_draft_per_patient),
        // que se puede violar por una carrera contra la ruta legacy
        // (PlansService.createOrGetDraft), que no toma ningún lock sobre
        // ClinicalEncounter. Si eso ocurre, dejamos que el error P2002 aborte y
        // haga ROLLBACK de esta transacción tal cual -- Postgres deja la
        // transacción en estado "aborted" tras una violación de constraint, así
        // que NUNCA se debe intentar otra query contra este mismo `tx` después de
        // esto. La resolución de la carrera se hace en el catch, fuera de esta
        // transacción, con una conexión nueva vía `this.prisma`.
        const created = await tx.nutritionalPlan.create({
          data: {
            patientId,
            // Decisión Corte 4 (documentada, no autoridad de autorización): se
            // persiste el usuario autenticado que realiza la creación
            // encounter-scoped, no responsibleProfessionalId del Encounter --
            // no existe razón técnica para desacoplarlos hoy. userId sigue
            // siendo puramente informativo/legacy; toda autorización nueva es
            // exclusivamente WorkspaceMember vía EncountersService.
            userId,
            assessmentId: assessment.id,
            encounterId,
            // La fecha viene de la consulta, nunca de new Date() ni de un input
            // del cliente -- mismo criterio que Assessment (corte 3).
            date: encounter.clinicalDate,
            sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
            calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
            calculatedAt: new Date(),
            config: config as unknown as Prisma.InputJsonValue,
            engineVersion: ENGINE_VERSION,
            status: 'DRAFT',
          },
        });

        await this.encounters.reconcilePlanningModule(tx, encounterId, 'IN_PROGRESS', null);

        const full = await tx.nutritionalPlan.findUniqueOrThrow({ where: { id: created.id } });
        return this.plans.mapToDto(full);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.resolveDraftRaceOutcome(patientId, encounterId);
      }
      throw e;
    }
  }

  /**
   * Se invoca DESPUÉS de que la transacción de creación fue abortada por P2002
   * contra el índice único parcial "un DRAFT por paciente" -- nunca reutiliza el
   * `tx` que recibió la violación (ya está en estado aborted). Usa `this.prisma`
   * (conexión/transacción nueva, autocommit) para inspeccionar cuál DRAFT ganó
   * realmente la carrera y responder según su asociación real, nunca según lo
   * que ESTA request intentaba crear.
   */
  private async resolveDraftRaceOutcome(patientId: string, encounterId: string) {
    const winner = await this.prisma.nutritionalPlan.findFirst({ where: { patientId, status: 'DRAFT' } });
    if (!winner) {
      // Ventana extremadamente corta donde el DRAFT ganador ya dejó de ser DRAFT
      // entre el P2002 y esta lectura -- nunca se traduce en 500: se informa
      // como conflicto transitorio para que el caller reintente.
      throw new ConflictException({
        code: 'PLAN_DRAFT_RACE_UNRESOLVED',
        message: 'No se pudo determinar el resultado de la carrera de creación del plan; reintente la operación.',
      });
    }
    if (winner.encounterId === encounterId) {
      return this.plans.mapToDto(winner);
    }
    if (winner.encounterId === null) {
      throw new ConflictException({
        code: 'PATIENT_HAS_UNLINKED_DRAFT_PLAN',
        message: 'El paciente tiene un plan en borrador sin vincular a ninguna consulta.',
      });
    }
    throw new ConflictException({
      code: 'PATIENT_HAS_OTHER_DRAFT_PLAN',
      message: 'El paciente tiene un plan en borrador activo en otra consulta.',
    });
  }

  // GET /patients/:patientId/encounters/:encounterId/plan
  async findOne(userId: string, patientId: string, encounterId: string) {
    // Misma consistencia estructural que las mutaciones -- reutiliza
    // EncountersService en vez de duplicar la autorización.
    await this.encounters.findAccessibleEncounterForRead(userId, patientId, encounterId);

    const plan = await this.prisma.nutritionalPlan.findUnique({ where: { encounterId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.plans.mapToDto(plan);
  }

  // POST /patients/:patientId/encounters/:encounterId/plan/recalculate
  async recalculate(userId: string, patientId: string, encounterId: string, dto: RecalculatePlanDto) {
    return this.prisma.$transaction(async (tx) => {
      const { plan } = await this.lockEncounterAndPlan(tx, userId, patientId, encounterId);
      if (plan.status !== 'DRAFT') {
        throw new ConflictException({ code: 'PLAN_NOT_DRAFT', message: 'El plan de esta consulta ya no es un borrador.' });
      }

      // Reutiliza EXACTAMENTE la lógica actual de PlansService: trabaja sobre
      // sourceSnapshot congelado, con la única excepción legacy ya existente
      // (upgrade v2 one-time dentro de ensureSnapshotV2) -- nunca duplica el
      // cálculo, el upgrade de snapshot, la metadata ni las estrategias.
      const current = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: plan.id } });
      const { snapshot, upgraded } = await this.plans.ensureSnapshotV2(tx, current);

      const calculationResults = this.planCalculation.calculate(snapshot, dto);
      const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, dto);

      const updated = await tx.nutritionalPlan.update({
        where: { id: plan.id },
        data: {
          ...(upgraded ? { sourceSnapshot: snapshot as unknown as Prisma.InputJsonValue } : {}),
          calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
          calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
          calculatedAt: new Date(),
          config: dto as unknown as Prisma.InputJsonValue,
          engineVersion: ENGINE_VERSION,
        },
      });
      // PLANNING se mantiene IN_PROGRESS -- recalculate nunca cambia el status
      // del Plan ni del módulo, solo sus resultados/config.
      return this.plans.mapToDto(updated);
    });
  }

  // POST /patients/:patientId/encounters/:encounterId/plan/finalize
  async finalize(userId: string, patientId: string, encounterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const { plan } = await this.lockEncounterAndPlan(tx, userId, patientId, encounterId);
      if (plan.status !== 'DRAFT') {
        throw new ConflictException({ code: 'PLAN_NOT_DRAFT', message: 'El plan de esta consulta ya no es un borrador.' });
      }

      // Exclusivamente el snapshot/config persistidos -- nunca un re-fetch de
      // Patient/Assessment, mismo criterio que PlansService.finalize().
      const current = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: plan.id } });
      const snapshot = current.sourceSnapshot as unknown as AssessmentSnapshot;
      const config = (current.config ?? {}) as unknown as RecalculatePlanDto;

      const calculationResults = this.planCalculation.calculate(snapshot, config);
      const calculationMetadata = this.planCalculation.buildCalculationMetadata(calculationResults, config);
      const readiness = this.planCalculation.evaluateFinalizationReadiness(snapshot, config, calculationResults);

      // evaluateFinalizationReadiness() sigue siendo la ÚNICA autoridad para
      // decidir si ESTE plan puede finalizar -- nunca se exige que todas las
      // métricas futuras posibles estén CALCULATED.
      if (!readiness.canFinalize) {
        throw new BadRequestException({
          message: 'No se puede finalizar: hay datos faltantes o inválidos.',
          finalizationBlockers: readiness.finalizationBlockers,
        });
      }

      // Único timestamp lógico de finalización, compartido entre NutritionalPlan
      // y EncounterModuleState -- nunca deben divergir por una operación normal.
      const finalizedAt = new Date();

      // Defensive belt-and-suspenders: el lock FOR UPDATE ya garantiza que esto
      // no puede afectar 0 filas en la práctica (mismo patrón que
      // PlansService.finalize() / AssessmentsService.complete()).
      const updateResult = await tx.nutritionalPlan.updateMany({
        where: { id: plan.id, status: 'DRAFT' },
        data: {
          status: 'FINALIZED',
          finalizedAt,
          calculationResults: calculationResults as unknown as Prisma.InputJsonValue,
          calculationMetadata: calculationMetadata as unknown as Prisma.InputJsonValue,
          calculatedAt: finalizedAt,
          config: config as unknown as Prisma.InputJsonValue,
          engineVersion: ENGINE_VERSION,
        },
      });
      if (updateResult.count === 0) {
        throw new ConflictException('Plan was already finalized by another request.');
      }

      // NutritionalPlan es la autoridad clínica; EncounterModuleState solo se
      // reconcilia DESPUÉS de que el Plan quedó FINALIZED de forma efectiva --
      // nunca al revés. Ambos ocurren en la misma transacción: si cualquier
      // paso posterior fallara, todo se revierte junto.
      await this.encounters.reconcilePlanningModule(tx, encounterId, 'COMPLETED', finalizedAt);

      const final = await tx.nutritionalPlan.findFirstOrThrow({ where: { id: plan.id } });
      return this.plans.mapToDto(final);
    });
  }
}
