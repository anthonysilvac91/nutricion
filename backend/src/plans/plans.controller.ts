import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { SubscriptionWriteGuard } from '../auth/guards/subscription-write.guard';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { RecalculatePlanDto } from './dto/recalculate-plan.dto';

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

    // POST /patients/:patientId/plans  →  crea o devuelve borrador activo, ligado a un Assessment COMPLETED
    @ApiOperation({ summary: 'Crear o recuperar borrador activo del paciente, a partir de una evaluación completada' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans')
    createOrGetDraft(@Req() req: any, @Param('patientId') patientId: string, @Body() dto: CreatePlanDto) {
        return this.plans.createOrGetDraft(req.user.sub, patientId, dto);
    }

    // GET /patients/:patientId/plans/:id
    @ApiOperation({ summary: 'Obtener una planificación por ID' })
    @Get('patients/:patientId/plans/:id')
    findOne(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string) {
        return this.plans.findOne(req.user.sub, patientId, id);
    }

    // POST /patients/:patientId/plans/:id/recalculate
    @ApiOperation({ summary: 'Recalcular resultados clínicos del plan a partir de las elecciones de la nutricionista' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans/:id/recalculate')
    recalculate(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string, @Body() dto: RecalculatePlanDto) {
        return this.plans.recalculate(req.user.sub, patientId, id, dto);
    }

    // POST /patients/:patientId/plans/:id/finalize
    // FINALIZED is permanently immutable -- there is no reopen route. A correction to a
    // finalized plan must happen as a new plan/version, never by mutating this one.
    @ApiOperation({ summary: 'Finalizar planificación' })
    @UseGuards(SubscriptionWriteGuard)
    @Post('patients/:patientId/plans/:id/finalize')
    finalize(@Req() req: any, @Param('patientId') patientId: string, @Param('id') id: string) {
        return this.plans.finalize(req.user.sub, patientId, id);
    }
}
