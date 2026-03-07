import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FindAllPatientsDto } from './dto/find-all-patients.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) { }

  create(userId: string, dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        sex: dto.sex,
        birthDate: new Date(dto.birthDate),
        activityLevel: dto.activityLevel,
      },
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

  async getPlanningContext(userId: string, id: string) {
    const patient = await this.findOne(userId, id);

    const latestAssessment = await this.prisma.assessment.findFirst({
      where: { patientId: id, status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      include: {
        results: true,
      }
    });

    // Mapeo inicial (con mocks parciales listos para Fase 3 avanzada)
    const context = {
      patientId: patient.id,
      latestAssessmentId: latestAssessment?.id || null,
      resolvedProfile: {
        ageGroup: latestAssessment?.populationGroup || 'ADULT',
        activityProfile: patient.activityLevel,
        targetAudience: 'GENERAL'
      },
      availableData: {
        tdeeKcal: null as number | null,
        proteinNeedsGrams: null as number | null
      },
      clinicalAlerts: [] as any[],
      missingRequirements: [] as string[]
    };

    if (latestAssessment) {
      // Intentar popular availableData de cálculos reales
      const bmiResult = latestAssessment.results.find(r => r.metricId === 'BMI');
      if (bmiResult && (bmiResult.statusCode === 'UNDERWEIGHT' || bmiResult.statusCode === 'OVERWEIGHT')) {
        context.clinicalAlerts.push({
          metric: 'BMI',
          alertType: 'WARNING',
          message: `Paciente presenta un estado de: ${bmiResult.statusLabel || bmiResult.statusCode}`
        });
      }

      const tdeeResult = latestAssessment.results.find(r => r.metricId === 'TDEE');
      if (tdeeResult && tdeeResult.numericValue) {
        context.availableData.tdeeKcal = tdeeResult.numericValue;
      } else {
        context.missingRequirements.push('ENERGY_REQUIREMENT_MISSING');
      }
    } else {
      context.missingRequirements.push('NO_COMPLETED_ASSESSMENT');
    }

    return context;
  }
}
