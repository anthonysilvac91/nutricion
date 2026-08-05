import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EncounterModule, EncounterStatus, ModuleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatClinicalDate, parseClinicalDate } from '../common/clinical-date.util';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { DiscardEncounterDto } from './dto/discard-encounter.dto';
import { FindEncountersDto } from './dto/find-encounters.dto';
import { ENCOUNTER_MODULE_ORDER, FOUNDATION_FLOW_VERSION, getModuleStatesForProfile, initialStatusFor } from './foundation-flow.constants';

type ModuleStateRow = { module: EncounterModule; applicability: string; status: string; completedAt: Date | null };
type EncounterRow = {
  id: string;
  patientId: string;
  workspaceId: string;
  responsibleProfessionalId: string;
  profile: string;
  type: string;
  status: string;
  flowVersion: string;
  clinicalDate: Date;
  startedAt: Date;
  completedAt: Date | null;
  discardedAt: Date | null;
  consultationReason: string | null;
  discardReason: string | null;
  notes?: string | null;
};

@Injectable()
export class EncountersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Autorización por Workspace (no por Patient.userId), resuelta en una sola
   * consulta: un Patient inexistente, un Patient con workspaceId null
   * (columna nullable hasta la Migración B, ver corte 1), un Patient de otro
   * Workspace, y un usuario sin membership en ese Workspace son
   * indistinguibles desde afuera -- los cuatro casos producen exactamente el
   * mismo `patient === null` aquí y el mismo 404 en el llamador. Nunca 403,
   * y nunca un código distinto (ej. "el paciente no tiene workspace") que
   * permitiría a alguien sin ninguna relación con el paciente deducir su
   * existencia o estado.
   */
  private async resolveAccessiblePatientWorkspace(userId: string, patientId: string): Promise<{ workspaceId: string } | null> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, workspace: { members: { some: { userId } } } },
      select: { workspaceId: true },
    });
    // patient.workspaceId no puede ser null aquí -- el filtro `workspace: {...}`
    // sólo matchea cuando existe un Workspace con esa membership, pero Prisma
    // sigue tipando el campo como nullable porque no lo sabe estáticamente.
    if (!patient || !patient.workspaceId) return null;
    return { workspaceId: patient.workspaceId };
  }

  private async requireAccessiblePatientWorkspace(userId: string, patientId: string): Promise<{ workspaceId: string }> {
    const access = await this.resolveAccessiblePatientWorkspace(userId, patientId);
    if (!access) throw new NotFoundException('Patient not found');
    return access;
  }

  // POST /patients/:patientId/encounters
  async create(userId: string, patientId: string, dto: CreateEncounterDto) {
    const { workspaceId } = await this.requireAccessiblePatientWorkspace(userId, patientId);
    const clinicalDate = parseClinicalDate(dto.clinicalDate);

    // Pre-chequeo rápido para el caso común (sin carrera): evita intentar el
    // INSERT cuando ya sabemos que va a fallar. La autoridad real contra
    // condiciones de carrera es el índice único parcial de la migración,
    // capturado más abajo como P2002 -- este pre-chequeo es solo una
    // optimización de UX, nunca la garantía.
    const existingInProgress = await this.prisma.clinicalEncounter.findFirst({
      where: { patientId, status: EncounterStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (existingInProgress) {
      throw new ConflictException({
        code: 'ENCOUNTER_ALREADY_IN_PROGRESS',
        message: 'Ya existe una consulta en curso para este paciente.',
      });
    }

    const moduleSeeds = getModuleStatesForProfile(dto.profile);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const encounter = await tx.clinicalEncounter.create({
          data: {
            workspaceId,
            patientId,
            responsibleProfessionalId: userId,
            profile: dto.profile,
            type: dto.type,
            status: EncounterStatus.IN_PROGRESS,
            flowVersion: FOUNDATION_FLOW_VERSION,
            clinicalDate,
            consultationReason: dto.consultationReason,
            notes: dto.notes,
          },
        });

        await tx.encounterModuleState.createMany({
          data: moduleSeeds.map(({ module, applicability }) => ({
            encounterId: encounter.id,
            module,
            applicability,
            status: initialStatusFor(applicability),
          })),
        });

        return encounter;
      });

      return this.findOneForPatient(userId, patientId, created.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Otra request ganó la carrera contra el índice único parcial
        // "ClinicalEncounter_one_in_progress_per_patient" entre el
        // pre-chequeo y este insert.
        throw new ConflictException({
          code: 'ENCOUNTER_ALREADY_IN_PROGRESS',
          message: 'Ya existe una consulta en curso para este paciente.',
        });
      }
      throw e;
    }
  }

  // GET /patients/:patientId/encounters
  async findAllByPatient(userId: string, patientId: string, query: FindEncountersDto) {
    await this.requireAccessiblePatientWorkspace(userId, patientId);

    const page = query.page || 1;
    const pageSize = query.pageSize || 10;
    const skip = (page - 1) * pageSize;

    // El filtro de WorkspaceMember se repite aquí como defensa en profundidad
    // -- la consulta que realmente devuelve datos nunca depende exclusivamente
    // del chequeo de acceso hecho arriba.
    const where: Prisma.ClinicalEncounterWhereInput = {
      patientId,
      workspace: { members: { some: { userId } } },
      ...(query.status ? { status: query.status } : {}),
      ...(query.profile ? { profile: query.profile } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.clinicalEncounter.findMany({
        where,
        include: { modules: { select: { applicability: true, status: true } } },
        // Orden determinístico: clinicalDate DESC, startedAt DESC, id DESC --
        // nunca se depende del orden natural/accidental de PostgreSQL.
        orderBy: [{ clinicalDate: 'desc' }, { startedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.clinicalEncounter.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.mapSummary(row)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // GET /patients/:patientId/encounters/:encounterId
  async findOneForPatient(userId: string, patientId: string, encounterId: string) {
    const encounter = await this.prisma.clinicalEncounter.findFirst({
      where: {
        id: encounterId,
        patientId,
        workspace: { members: { some: { userId } } },
      },
      include: { modules: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    return this.mapDetail(encounter);
  }

  // POST /patients/:patientId/encounters/:encounterId/discard
  async discard(userId: string, patientId: string, encounterId: string, dto: DiscardEncounterDto) {
    await this.prisma.$transaction(async (tx) => {
      // Combina en una sola consulta: existencia, pertenencia al paciente,
      // membership del usuario en el Workspace del Encounter, y el lock de
      // fila -- mismo patrón que AssessmentsService.lockDraftAssessment /
      // PlansService.lockPlanRow, adaptado a autorización por Workspace.
      const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT e.id, e.status
        FROM "ClinicalEncounter" e
        JOIN "WorkspaceMember" m ON m."workspaceId" = e."workspaceId" AND m."userId" = ${userId}
        WHERE e.id = ${encounterId} AND e."patientId" = ${patientId}
        FOR UPDATE OF e
      `;
      const encounter = rows[0];
      if (!encounter) throw new NotFoundException('Encounter not found');
      if (encounter.status !== EncounterStatus.IN_PROGRESS) {
        throw new ConflictException({
          code: 'ENCOUNTER_NOT_IN_PROGRESS',
          message: 'La consulta ya no está en curso.',
        });
      }

      // Defensive belt-and-suspenders: el lock FOR UPDATE ya garantiza que esto
      // no puede afectar 0 filas en la práctica, pero el WHERE condicional +
      // chequeo de count deja el invariante explícito (mismo patrón que
      // AssessmentsService.complete() / PlansService.finalize()).
      const updated = await tx.clinicalEncounter.updateMany({
        where: { id: encounterId, status: EncounterStatus.IN_PROGRESS },
        data: {
          status: EncounterStatus.DISCARDED,
          discardedAt: new Date(),
          discardReason: dto.discardReason,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException({
          code: 'ENCOUNTER_NOT_IN_PROGRESS',
          message: 'La consulta ya no está en curso.',
        });
      }
    });

    return this.findOneForPatient(userId, patientId, encounterId);
  }

  private sortModules(modules: ModuleStateRow[]): ModuleStateRow[] {
    const orderIndex = new Map(ENCOUNTER_MODULE_ORDER.map((m, i) => [m, i]));
    return [...modules].sort((a, b) => (orderIndex.get(a.module) ?? 0) - (orderIndex.get(b.module) ?? 0));
  }

  private computeProgress(modules: { applicability: string; status: string }[]) {
    const applicable = modules.filter((m) => m.applicability !== 'NOT_APPLICABLE');
    const completed = applicable.filter((m) => m.status === ModuleStatus.COMPLETED);
    return { completed: completed.length, total: applicable.length };
  }

  private mapSummary(row: EncounterRow & { modules: { applicability: string; status: string }[] }) {
    return {
      id: row.id,
      patientId: row.patientId,
      workspaceId: row.workspaceId,
      profile: row.profile,
      type: row.type,
      status: row.status,
      flowVersion: row.flowVersion,
      clinicalDate: formatClinicalDate(row.clinicalDate),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      discardedAt: row.discardedAt,
      consultationReason: row.consultationReason,
      discardReason: row.discardReason,
      responsibleProfessionalId: row.responsibleProfessionalId,
      progress: this.computeProgress(row.modules),
    };
  }

  private mapDetail(row: EncounterRow & { modules: ModuleStateRow[] }) {
    const modules = this.sortModules(row.modules);
    return {
      id: row.id,
      patientId: row.patientId,
      workspaceId: row.workspaceId,
      profile: row.profile,
      type: row.type,
      status: row.status,
      flowVersion: row.flowVersion,
      clinicalDate: formatClinicalDate(row.clinicalDate),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      discardedAt: row.discardedAt,
      consultationReason: row.consultationReason,
      discardReason: row.discardReason,
      notes: row.notes ?? null,
      responsibleProfessionalId: row.responsibleProfessionalId,
      modules: modules.map((m) => ({
        module: m.module,
        applicability: m.applicability,
        status: m.status,
        completedAt: m.completedAt,
      })),
      progress: this.computeProgress(modules),
    };
  }
}
