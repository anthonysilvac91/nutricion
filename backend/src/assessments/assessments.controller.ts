import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { CreateDraftDto } from './dto/create-draft.dto';
import { UpsertMeasurementsDto } from './dto/upsert-measurements.dto';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { AssessmentStatus } from '@prisma/client';
import { MeasurementSummaryService } from './measurement-summary.service';

@ApiTags('Assessments')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller() // Base param mapped below to keep logic unified
export class AssessmentsController {
    constructor(
        private readonly assessments: AssessmentsService,
        private readonly measurementSummary: MeasurementSummaryService,
    ) { }

    // POST /patients/:id/assessments
    @ApiOperation({ summary: 'Registrar nuevo Assessment (Evaluación Clínica)' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/assessments')
    create(@Req() req: any, @Param('patientId') patientId: string, @Body() dto: CreateAssessmentDto) {
        return this.assessments.create(req.user.sub, patientId, dto);
    }

    // POST /patients/:id/assessments/draft
    @ApiOperation({ summary: 'Crear o recuperar el Assessment DRAFT activo del paciente' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/assessments/draft')
    createOrGetDraft(@Req() req: any, @Param('patientId') patientId: string, @Body() dto: CreateDraftDto) {
        return this.assessments.createOrGetDraft(req.user.sub, patientId, dto);
    }

    // GET /patients/:id/assessments?status=COMPLETED
    @ApiOperation({ summary: 'Listar evaluaciones del paciente, opcionalmente filtradas por estado' })
    @Get('patients/:patientId/assessments')
    findAll(@Req() req: any, @Param('patientId') patientId: string, @Query('status') status?: AssessmentStatus) {
        return this.assessments.findAllByPatient(req.user.sub, patientId, status);
    }

    // GET /patients/:id/assessments/latest
    @ApiOperation({ summary: 'Obtener la última evaluación (Assessment) del paciente' })
    @Get('patients/:patientId/assessments/latest')
    findLatest(@Req() req: any, @Param('patientId') patientId: string) {
        return this.assessments.findLatestByPatient(req.user.sub, patientId);
    }

    // GET /patients/:id/measurement-summary
    @ApiOperation({ summary: 'Resumen de mediciones: borrador activo + último/anterior valor completado por tipo' })
    @Get('patients/:patientId/measurement-summary')
    getSummary(@Req() req: any, @Param('patientId') patientId: string) {
        return this.measurementSummary.getSummary(req.user.sub, patientId);
    }

    // GET /patients/:id/measurements/:definitionId/history
    @ApiOperation({ summary: 'Historial paginado de una medición (solo evaluaciones COMPLETED)' })
    @Get('patients/:patientId/measurements/:definitionId/history')
    getHistory(
        @Req() req: any,
        @Param('patientId') patientId: string,
        @Param('definitionId') definitionId: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.measurementSummary.getHistory(req.user.sub, patientId, definitionId, Number(page) || 1, Number(pageSize) || 20);
    }

    // GET /patients/:id/assessments/:assessmentId (declarada después de 'latest' para que Nest no la confunda con este literal)
    @ApiOperation({ summary: 'Obtener una evaluación del paciente por ID' })
    @Get('patients/:patientId/assessments/:assessmentId')
    findOneForPatient(@Req() req: any, @Param('patientId') patientId: string, @Param('assessmentId') assessmentId: string) {
        return this.assessments.findOneForPatient(req.user.sub, patientId, assessmentId);
    }

    // PATCH /patients/:id/assessments/:assessmentId/measurements
    @ApiOperation({ summary: 'Agregar o actualizar mediciones del Assessment DRAFT (upsert)' })
    @UseGuards(SubscriptionWriteGuard)
    @Patch('patients/:patientId/assessments/:assessmentId/measurements')
    upsertMeasurements(
        @Req() req: any,
        @Param('patientId') patientId: string,
        @Param('assessmentId') assessmentId: string,
        @Body() dto: UpsertMeasurementsDto,
    ) {
        return this.assessments.upsertMeasurements(req.user.sub, patientId, assessmentId, dto);
    }

    // DELETE /patients/:id/assessments/:assessmentId/measurements/:definitionId
    @ApiOperation({ summary: 'Eliminar una medición del Assessment DRAFT' })
    @UseGuards(SubscriptionWriteGuard)
    @Delete('patients/:patientId/assessments/:assessmentId/measurements/:definitionId')
    removeMeasurement(
        @Req() req: any,
        @Param('patientId') patientId: string,
        @Param('assessmentId') assessmentId: string,
        @Param('definitionId') definitionId: string,
    ) {
        return this.assessments.removeMeasurement(req.user.sub, patientId, assessmentId, definitionId);
    }

    // POST /patients/:id/assessments/:assessmentId/complete
    @ApiOperation({ summary: 'Completar el Assessment DRAFT: corre el motor clínico y lo deja de solo lectura' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/assessments/:assessmentId/complete')
    complete(@Req() req: any, @Param('patientId') patientId: string, @Param('assessmentId') assessmentId: string) {
        return this.assessments.complete(req.user.sub, patientId, assessmentId);
    }

    // GET /assessments/:id
    @ApiOperation({ summary: 'Obtener un Assessment particular por ID' })
    @Get('assessments/:id')
    findOne(@Req() req: any, @Param('id') id: string) {
        return this.assessments.findOne(req.user.sub, id);
    }
}
