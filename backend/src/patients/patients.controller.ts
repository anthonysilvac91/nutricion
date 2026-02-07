import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { PatientsService } from './patients.service';

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('patients') // BASE ROUTE: /patients
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  // POST /patients
  @ApiOperation({ summary: 'Crear paciente (del usuario autenticado)' })
  @Post()
  create(@Req() req: any, @Body() dto: CreatePatientDto) {
    return this.patients.create(req.user.sub, dto);
  }

  // GET /patients
  @ApiOperation({ summary: 'Listar pacientes del usuario autenticado' })
  @Get()
  findAll(@Req() req: any) {
    return this.patients.findAll(req.user.sub);
  }

  // GET /patients/:id
  @ApiOperation({ summary: 'Obtener un paciente (si pertenece al usuario)' })
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.patients.findOne(req.user.sub, id);
  }

  // PATCH /patients/:id
  @ApiOperation({ summary: 'Actualizar paciente (si pertenece al usuario)' })
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.patients.update(req.user.sub, id, dto);
  }

  // DELETE /patients/:id
  @ApiOperation({ summary: 'Eliminar paciente (si pertenece al usuario)' })
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.patients.remove(req.user.sub, id);
  }
}
