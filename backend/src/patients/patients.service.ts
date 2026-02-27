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
}
