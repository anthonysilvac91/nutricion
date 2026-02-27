import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FindNutritionistsDto } from './dto/find-nutritionists.dto';
import { UpdateNutritionistDto } from './dto/update-nutritionist.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    @ApiOperation({ summary: 'Obtener estadísticas globales sobre los usuarios nutricionistas' })
    @Get('stats')
    getStats() {
        return this.adminService.getStats();
    }

    @ApiOperation({ summary: 'Listar usuarios nutricionistas con paginación y búsqueda' })
    @Get('nutritionists')
    getNutritionists(@Query() query: FindNutritionistsDto) {
        return this.adminService.getNutritionists(query);
    }

    @ApiOperation({ summary: 'Bloquear, desbloquear o extender el periodo de prueba de un nutricionista' })
    @Patch('nutritionists/:id')
    updateNutritionist(@Param('id') id: string, @Body() dto: UpdateNutritionistDto) {
        return this.adminService.updateNutritionist(id, dto);
    }
}

