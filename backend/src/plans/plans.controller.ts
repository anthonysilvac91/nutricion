import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { PlansService } from './plans.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('Plans')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller()
export class PlansController {
    constructor(private readonly plans: PlansService) {}

    // GET /patients/:patientId/plans
    @ApiOperation({ summary: 'Listar planificaciones del paciente' })
    @Get('patients/:patientId/plans')
    findAll(@Req() req: any, @Param('patientId') patientId: string) {
        return this.plans.findAll(req.user.sub, patientId);
    }

    // POST /patients/:patientId/plans  →  crea o devuelve borrador activo
    @ApiOperation({ summary: 'Crear o recuperar borrador activo del paciente' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans')
    createOrGetDraft(@Req() req: any, @Param('patientId') patientId: string) {
        return this.plans.createOrGetDraft(req.user.sub, patientId);
    }

    // GET /patients/:patientId/plans/:id
    @ApiOperation({ summary: 'Obtener una planificación por ID' })
    @Get('patients/:patientId/plans/:id')
    findOne(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string) {
        return this.plans.findOne(req.user.sub, patientId, id);
    }

    // PATCH /patients/:patientId/plans/:id
    @ApiOperation({ summary: 'Guardar borrador (actualizar datos)' })
    @UseGuards(SubscriptionWriteGuard)
    @Patch('patients/:patientId/plans/:id')
    save(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string, @Body() dto: UpdatePlanDto) {
        return this.plans.save(req.user.sub, patientId, id, dto);
    }

    // POST /patients/:patientId/plans/:id/finalize
    @ApiOperation({ summary: 'Finalizar planificación' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans/:id/finalize')
    finalize(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string) {
        return this.plans.finalize(req.user.sub, patientId, id);
    }

    // POST /patients/:patientId/plans/:id/reopen
    @ApiOperation({ summary: 'Reabrir planificación finalizada como borrador' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans/:id/reopen')
    reopen(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string) {
        return this.plans.reopen(req.user.sub, patientId, id);
    }
}
