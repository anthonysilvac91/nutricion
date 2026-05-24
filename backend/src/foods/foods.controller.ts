import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtGuard } from '../auth/jwt.guard';
import { FoodsService } from './foods.service';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { CreateFoodDto } from './dto/create-food.dto';

@ApiTags('Foods')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller('foods')
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  // GET /foods/sources
  @ApiOperation({ summary: 'Listar fuentes nutricionales disponibles' })
  @Get('sources')
  getSources() {
    return this.foods.getSources();
  }

  // GET /foods/categories
  @ApiOperation({ summary: 'Listar categorías disponibles' })
  @Get('categories')
  getCategories(@Req() req: any) {
    return this.foods.getCategories(req.user.sub);
  }

  // GET /foods
  @ApiOperation({ summary: 'Buscar alimentos' })
  @Get()
  search(@Req() req: any, @Query() dto: SearchFoodsDto) {
    return this.foods.search(req.user.sub, dto);
  }

  // GET /foods/:id
  @ApiOperation({ summary: 'Detalle de un alimento' })
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.foods.findOne(req.user.sub, id);
  }

  // POST /foods  — crea alimento personalizado
  @ApiOperation({ summary: 'Crear alimento personalizado' })
  @Post()
  create(@Req() req: any, @Body() dto: CreateFoodDto) {
    return this.foods.create(req.user.sub, dto);
  }

  // PATCH /foods/:id
  @ApiOperation({ summary: 'Editar alimento personalizado propio' })
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: CreateFoodDto) {
    return this.foods.update(req.user.sub, id, dto);
  }

  // DELETE /foods/:id
  @ApiOperation({ summary: 'Eliminar alimento personalizado propio' })
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.foods.remove(req.user.sub, id);
  }
}
