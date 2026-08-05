import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FindAllPatientsDto } from './dto/find-all-patients.dto';
import { CalculationStrategyRegistry } from '../calculation-engine/calculation-strategy-registry.service';
import { PAL_OPTIONS, MACRO_METHOD_OPTIONS } from '../calculation-engine/defaults';
import { formatClinicalDate } from '../common/clinical-date.util';

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationStrategies: CalculationStrategyRegistry,
  ) { }

  async create(userId: string, dto: CreatePatientDto) {
    const workspaceId = await this.resolvePersonalWorkspaceId(userId);
    return this.prisma.patient.create({
      data: {
        userId,
        workspaceId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        sex: dto.sex,
        birthDate: new Date(dto.birthDate),
        activityLevel: dto.activityLevel,
      },
    });
  }

  /**
   * Resuelve el Workspace PERSONAL del usuario, creándolo de forma perezosa si
   * todavía no existe -- los usuarios registrados antes del backfill de la
   * fundación Workspace ya lo tienen; los usuarios nuevos lo obtienen aquí en
   * su primer paciente. La idempotencia depende del índice único parcial
   * "Workspace_one_personal_per_owner" (ownerUserId) WHERE type='PERSONAL':
   * el INSERT ... ON CONFLICT lo usa como target explícito, igual que
   * prisma/backfill-workspaces.ts (no dupliques esta lógica sin mantenerla en
   * sync con ese script). Esto NO cambia autorización: el resto de este
   * servicio sigue filtrando exclusivamente por userId.
   */
  private async resolvePersonalWorkspaceId(userId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "Workspace" ("id", "ownerUserId", "type", "name", "timezone", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${userId}, 'PERSONAL', 'Espacio personal', 'America/Santiago', now(), now())
        ON CONFLICT ("ownerUserId") WHERE "type" = 'PERSONAL' DO NOTHING
        RETURNING "id"
      `;
      const workspaceId =
        inserted.length > 0
          ? inserted[0].id
          : (
              await tx.workspace.findFirstOrThrow({
                where: { ownerUserId: userId, type: 'PERSONAL' },
                select: { id: true },
              })
            ).id;

      await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        update: {},
        create: { workspaceId, userId, role: 'OWNER' },
      });

      return workspaceId;
    });
  }

  async findAll(userId: string, query?: FindAllPatientsDto) {
    const page = query?.page || 1;
    const pageSize = query?.pageSize || 10;
    const skip = (page - 1) * pageSize;
    const search = query?.search;

    const where: any = {
      userId,
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, userId },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(userId: string, id: string, dto: UpdatePatientDto) {
    const updateResult = await this.prisma.patient.updateMany({
      where: { id, userId },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
        ...(dto.activityLevel !== undefined ? { activityLevel: dto.activityLevel } : {}),
      },
    });

    if (updateResult.count === 0) {
      throw new NotFoundException('Patient not found');
    }

    // Devolvemos el paciente actualizado para mantener compatibilidad con el endpoint actual
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string) {
    const deleteResult = await this.prisma.patient.deleteMany({
      where: { id, userId },
    });

    if (deleteResult.count === 0) {
      throw new NotFoundException('Patient not found');
    }

    return { message: 'Patient removed successfully' };
  }

  // --- Endpoints Consolidados de Fase 3 (Lectura en base a Assessments) ---

  async getSummary(userId: string, id: string) {
    // Validar pertenencia y existencia
    const patient = await this.findOne(userId, id);

    // Buscar la última evaluación usando orderBy date decendente
    const latestAssessment = await this.prisma.assessment.findFirst({
      where: { patientId: id, status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      include: {
        measurements: true,
        results: true,
      }
    });

    // Calcular edad
    const ageMs = Date.now() - patient.birthDate.getTime();
    const ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));

    // Estructurar respuesta base
    const summary = {
      patientId: patient.id,
      demographics: { ageYears, sex: patient.sex },
      currentClinicalProfile: 'STANDARD',
      latestVitals: {},
      flags: [] as string[]
    };

    if (latestAssessment) {
      summary.currentClinicalProfile = `${latestAssessment.populationGroup}_${latestAssessment.specialProfile}`;

      const weightRec = latestAssessment.measurements.find(m => m.definitionId === 'm_weight');
      if (weightRec && weightRec.numericValue) {
        summary.latestVitals['weight'] = {
          value: weightRec.numericValue,
          date: latestAssessment.date,
          trend: "STABLE" // MOCKED for now due to lack of historical calculation 
        };
      }

      const bmiResult = latestAssessment.results.find(r => r.metricId === 'BMI');
      if (bmiResult) {
        summary.latestVitals['bmi'] = { value: bmiResult.numericValue, date: latestAssessment.date };
        if (bmiResult.statusCode === 'OVERWEIGHT' || bmiResult.statusCode === 'OBESE') {
          summary.flags.push('OVERWEIGHT_RISK');
        }
      }
    }

    return summary;
  }

  async getPlanningContext(userId: string, id: string, assessmentId?: string) {
    const patient = await this.findOne(userId, id);

    if (!assessmentId) {
      throw new BadRequestException('assessmentId query param is required');
    }

    const assessment = await this.prisma.assessment.findFirst({
      where: { id: assessmentId, patientId: id },
      include: { measurements: true, results: true },
    });

    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.status !== 'COMPLETED') {
      throw new BadRequestException('Assessment must be COMPLETED to be used for planning');
    }

    const population = (assessment.populationGroup ?? 'ADULT') as 'ADULT' | 'PEDIATRIC' | 'GERIATRIC';
    const weightRec = assessment.measurements.find(m => m.definitionId === 'm_weight');
    const heightRec = assessment.measurements.find(m => m.definitionId === 'm_height');
    const fatRec = assessment.measurements.find(m => m.definitionId === 'm_fat_percent');
    const ageYears = assessment.ageAtAssessmentMonths != null ? Math.floor(assessment.ageAtAssessmentMonths / 12) : null;

    const calculatedResults: Record<string, unknown> = {};
    const missingRequirements: string[] = [];
    const clinicalAlerts: { metric: string; alertType: string; message: string }[] = [];

    for (const metricId of ['BMI', 'BODY_FAT_PERCENTAGE', 'BMR', 'TDEE']) {
      const result = assessment.results.find(r => r.metricId === metricId);
      calculatedResults[metricId] = result ?? null;
      if (!result || result.status !== 'CALCULATED') {
        missingRequirements.push(`${metricId}_${result?.status ?? 'MISSING_DATA'}`);
      }
    }

    const bmiResult = assessment.results.find(r => r.metricId === 'BMI');
    if (bmiResult && ['UNDERWEIGHT', 'OVERWEIGHT', 'OBESE'].includes(bmiResult.statusCode ?? '')) {
      clinicalAlerts.push({
        metric: 'BMI',
        alertType: 'WARNING',
        message: `Paciente presenta un estado de: ${bmiResult.statusLabel || bmiResult.statusCode}`,
      });
    }

    return {
      assessmentId: assessment.id,
      date: formatClinicalDate(assessment.date),
      ageYears,
      sex: patient.sex,
      activityLevel: patient.activityLevel,
      populationGroup: population,
      weightKg: weightRec?.numericValue ?? null,
      heightCm: heightRec?.numericValue ?? null,
      fatPercentMeasured: fatRec?.numericValue ?? null,
      calculatedResults,
      missingRequirements,
      clinicalAlerts,
      availableFormulas: {
        bmi: this.calculationStrategies.listCatalog('BMI', 'ASSESSMENT', population),
        bmr: this.calculationStrategies.listCatalog('BMR', 'PLAN', population),
        macroMethods: MACRO_METHOD_OPTIONS,
        fiberSources: this.calculationStrategies.listCatalog('FIBER_G', 'PLAN', population),
        waterSources: this.calculationStrategies.listCatalog('WATER_ML', 'PLAN', population),
        palOptions: PAL_OPTIONS,
      },
    };
  }
}
