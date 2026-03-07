import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';

@ApiTags('Assessments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller() // Base param mapped below to keep logic unified
export class AssessmentsController {
    constructor(private readonly assessments: AssessmentsService) { }

    // POST /patients/:id/assessments
    @ApiOperation({ summary: 'Registrar nuevo Assessment (Evaluación Clínica)' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/assessments')
    create(@Param('patientId') patientId: string, @Body() dto: CreateAssessmentDto) {
        return this.assessments.create(patientId, dto);
    }

    // GET /patients/:id/assessments/latest
    @ApiOperation({ summary: 'Obtener la última evaluación (Assessment) del paciente' })
    @Get('patients/:patientId/assessments/latest')
    findLatest(@Param('patientId') patientId: string) {
        return this.assessments.findLatestByPatient(patientId);
    }

    // GET /assessments/:id
    @ApiOperation({ summary: 'Obtener un Assessment particular por ID' })
    @Get('assessments/:id')
    findOne(@Param('id') id: string) {
        return this.assessments.findOne(id);
    }

    // TODO: Add 'summary' and 'planning-context' inside Patient controller or here as generic
}
