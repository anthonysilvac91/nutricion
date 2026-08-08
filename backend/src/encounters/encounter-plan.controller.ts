import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { RecalculatePlanDto } from '../plans/dto/recalculate-plan.dto';
import { EncounterPlanService } from './encounter-plan.service';

// NutritionalPlan encounter-scoped: autoriza exclusivamente por WorkspaceMember,
// nunca por Patient.userId (ver EncounterPlanService). Las rutas legacy bajo
// /patients/:patientId/plans/... siguen existiendo para el flujo standalone --
// este controller es la única vía válida para crear/mutar el NutritionalPlan
// de una consulta clínica. La creación nunca acepta assessmentId del cliente:
// el Assessment fuente sale exclusivamente de encounter.assessment.
@ApiTags('Encounters')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller()
export class EncounterPlanController {
  constructor(private readonly encounterPlan: EncounterPlanService) {}

  // POST /patients/:patientId/encounters/:encounterId/plan -- create or get, idempotente
  @ApiOperation({ summary: 'Crear u obtener el plan nutricional de una consulta clínica (idempotente)' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/plan')
  createOrGet(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterPlan.createOrGet(req.user.sub, patientId, encounterId);
  }

  // GET /patients/:patientId/encounters/:encounterId/plan
  @ApiOperation({ summary: 'Obtener el plan nutricional de una consulta clínica' })
  @Get('patients/:patientId/encounters/:encounterId/plan')
  findOne(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterPlan.findOne(req.user.sub, patientId, encounterId);
  }

  // POST /patients/:patientId/encounters/:encounterId/plan/recalculate
  @ApiOperation({ summary: 'Recalcular resultados clínicos del plan DRAFT de la consulta' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/plan/recalculate')
  recalculate(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: RecalculatePlanDto,
  ) {
    return this.encounterPlan.recalculate(req.user.sub, patientId, encounterId, dto);
  }

  // POST /patients/:patientId/encounters/:encounterId/plan/finalize
  // FINALIZED es permanentemente inmutable -- no existe ruta de reapertura.
  @ApiOperation({ summary: 'Finalizar el plan DRAFT de la consulta' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/plan/finalize')
  finalize(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounterPlan.finalize(req.user.sub, patientId, encounterId);
  }
}
