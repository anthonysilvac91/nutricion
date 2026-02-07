import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

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

  findAll(userId: string) {
    return this.prisma.patient.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.userId !== userId) throw new ForbiddenException('Access denied');
    return patient;
  }

  async update(userId: string, id: string, dto: UpdatePatientDto) {
    await this.findOne(userId, id); // valida existencia + ownership

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
        ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
        ...(dto.activityLevel !== undefined ? { activityLevel: dto.activityLevel } : {}),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id); // valida existencia + ownership
    return this.prisma.patient.delete({ where: { id } });
  }
}
