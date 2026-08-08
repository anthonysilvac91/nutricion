import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { UpsertMeasurementsDto } from '../assessments/dto/upsert-measurements.dto';
import { EncounterAssessmentService } from './encounter-assessment.service';

// Assessment encounter-scoped: autoriza exclusivamente por WorkspaceMember,
// nunca por Patient.userId (ver EncounterAssessmentService). Las rutas legacy
// bajo /patients/:patientId/assessments/... siguen existiendo para el flujo
// standalone -- este controller es la única vía válida para mutar el
// Assessment de una consulta clínica.
@ApiTags('Encounters')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller()
export class EncounterAssessmentController {
  constructor(private readonly encounterAssessment: EncounterAssessmentService) {}

  // POST /patients/:patientId/encounters/:encounterId/assessment -- create or get, idempotente
  @ApiOperation({ summary: 'Crear u obtener el Assessment de una consulta clínica (idempotente)' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/assessment')
  createOrGet(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterAssessment.createOrGet(req.user.sub, patientId, encounterId);
  }

  // GET /patients/:patientId/encounters/:encounterId/assessment
  @ApiOperation({ summary: 'Obtener el Assessment de una consulta clínica' })
  @Get('patients/:patientId/encounters/:encounterId/assessment')
  findOne(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterAssessment.findOne(req.user.sub, patientId, encounterId);
  }

  // PATCH /patients/:patientId/encounters/:encounterId/assessment/measurements
  @ApiOperation({ summary: 'Agregar o actualizar mediciones del Assessment DRAFT de la consulta (upsert)' })
  @UseGuards(SubscriptionWriteGuard)
  @Patch('patients/:patientId/encounters/:encounterId/assessment/measurements')
  upsertMeasurements(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: UpsertMeasurementsDto,
  ) {
    return this.encounterAssessment.upsertMeasurements(req.user.sub, patientId, encounterId, dto);
  }

  // DELETE /patients/:patientId/encounters/:encounterId/assessment/measurements/:definitionId
  @ApiOperation({ summary: 'Eliminar una medición del Assessment DRAFT de la consulta' })
  @UseGuards(SubscriptionWriteGuard)
  @Delete('patients/:patientId/encounters/:encounterId/assessment/measurements/:definitionId')
  removeMeasurement(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Param('encounterId') encounterId: string,
    @Param('definitionId') definitionId: string,
  ) {
    return this.encounterAssessment.removeMeasurement(req.user.sub, patientId, encounterId, definitionId);
  }

  // POST /patients/:patientId/encounters/:encounterId/assessment/complete
  @ApiOperation({ summary: 'Completar el Assessment DRAFT de la consulta: corre el motor clínico y lo deja de solo lectura' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/assessment/complete')
  complete(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterAssessment.complete(req.user.sub, patientId, encounterId);
  }
}
