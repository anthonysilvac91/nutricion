import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiOkResponse } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { FindAllPatientsDto } from './dto/find-all-patients.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('patients') // BASE ROUTE: /patients
export class PatientsController {
  constructor(private readonly patients: PatientsService) { }

  // POST /patients
  @ApiOperation({ summary: 'Crear paciente (del usuario autenticado)' })
  @UseGuards(SubscriptionWriteGuard)
  @Post()
  create(@Req() req: any, @Body() dto: CreatePatientDto) {
    return this.patients.create(req.user.sub, dto);
  }

  // GET /patients
  @ApiOperation({ summary: 'Listar pacientes del usuario autenticado (con paginación y búsqueda)' })
  @ApiOkResponse({
    description: 'Devuelve la lista de pacientes paginada',
    schema: {
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            pageSize: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  @Get()
  findAll(@Req() req: any, @Query() query: FindAllPatientsDto) {
    return this.patients.findAll(req.user.sub, query);
  }

  // GET /patients/:id/summary
  @ApiOperation({ summary: 'Obtener un resumen estable del paciente' })
  @Get(':id/summary')
  getSummary(@Req() req: any, @Param('id') id: string) {
    return this.patients.getSummary(req.user.sub, id);
  }

  // GET /patients/:id/planning-context
  @ApiOperation({ summary: 'Obtener el contexto clínico digerido para Planificación' })
  @Get(':id/planning-context')
  getPlanningContext(@Req() req: any, @Param('id') id: string) {
    return this.patients.getPlanningContext(req.user.sub, id);
  }

  // GET /patients/:id
  @ApiOperation({ summary: 'Obtener un paciente (si pertenece al usuario)' })
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.patients.findOne(req.user.sub, id);
  }

  // PATCH /patients/:id
  @ApiOperation({ summary: 'Actualizar paciente (si pertenece al usuario)' })
  @UseGuards(SubscriptionWriteGuard)
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(req.user.sub, id, dto);
  }

  // DELETE /patients/:id
  @ApiOperation({ summary: 'Eliminar paciente (si pertenece al usuario)' })
  @UseGuards(SubscriptionWriteGuard)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.patients.remove(req.user.sub, id);
  }
}
