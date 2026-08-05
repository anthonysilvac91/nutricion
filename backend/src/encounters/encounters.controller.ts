import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { EncountersService } from './encounters.service';
import { CreateEncounterDto } from './dto/create-encounter.dto';
import { DiscardEncounterDto } from './dto/discard-encounter.dto';
import { FindEncountersDto } from './dto/find-encounters.dto';

// Deliberadamente NO existen en este corte: POST .../start (crear = iniciar,
// misma operación), POST .../complete, DELETE, PATCH genérico de status, ni
// endpoint para reabrir. Ver EncountersService para el detalle de por qué.
@ApiTags('Encounters')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller() // Base param mapeado explícitamente por ruta, mismo patrón que AssessmentsController
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  // POST /patients/:patientId/encounters -- crea e inicia la consulta en un solo paso (IN_PROGRESS)
  @ApiOperation({ summary: 'Iniciar una consulta clínica para un paciente' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters')
  create(@Req() req: any, @Param('patientId') patientId: string, @Body() dto: CreateEncounterDto) {
    return this.encounters.create(req.user.sub, patientId, dto);
  }

  // GET /patients/:patientId/encounters
  @ApiOperation({ summary: 'Listar el historial de consultas de un paciente' })
  @Get('patients/:patientId/encounters')
  findAll(@Req() req: any, @Param('patientId') patientId: string, @Query() query: FindEncountersDto) {
    return this.encounters.findAllByPatient(req.user.sub, patientId, query);
  }

  // GET /patients/:patientId/encounters/:encounterId
  @ApiOperation({ summary: 'Obtener el detalle y progreso básico de una consulta' })
  @Get('patients/:patientId/encounters/:encounterId')
  findOne(@Req() req: any, @Param('patientId') patientId: string, @Param('encounterId') encounterId: string) {
    return this.encounters.findOneForPatient(req.user.sub, patientId, encounterId);
  }

  // POST /patients/:patientId/encounters/:encounterId/discard
  @ApiOperation({ summary: 'Descartar una consulta en curso (terminal, no se puede reabrir)' })
  @UseGuards(SubscriptionWriteGuard)
  @Post('patients/:patientId/encounters/:encounterId/discard')
  discard(
    @Req() req: any,
    @Param('patientId') patientId: string,
    @Param('encounterId') encounterId: string,
    @Body() dto: DiscardEncounterDto,
  ) {
    return this.encounters.discard(req.user.sub, patientId, encounterId, dto);
  }
}
