import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchFoodsDto } from './dto/search-foods.dto';
import { CreateFoodDto } from './dto/create-food.dto';

@Injectable()
export class FoodsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Fuentes ──────────────────────────────────────────────────────────────────

  async getSources() {
    return this.prisma.foodSource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        region: true,
        type: true,
        description: true,
        url: true,
        lastSyncAt: true,
        _count: { select: { foods: { where: { isActive: true } } } },
      },
    });
  }

  // ── Búsqueda de alimentos ────────────────────────────────────────────────────

  async search(userId: string, dto: SearchFoodsDto) {
    const { q, sourceCode, category, page = 1, limit = 50 } = dto;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      isActive: true,
      AND: [
        // Visible si es global (userId null) o es propio del nutricionista
        { OR: [{ userId: null }, { userId: userId }] },
      ],
    };

    if (sourceCode) {
      where.AND.push({ source: { code: sourceCode } });
    }

    if (category) {
      where.AND.push({ category });
    }

    if (q && q.trim()) {
      const term = q.trim();
      where.AND.push({
        OR: [
          { nameEs: { contains: term, mode: 'insensitive' } },
          { name:   { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.foodItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nameEs: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          nameEs: true,
          category: true,
          energy: true,
          protein: true,
          carbs: true,
          fat: true,
          fiber: true,
          sugar: true,
          sodium: true,
          userId: true,
          source: { select: { id: true, code: true, name: true, region: true } },
        },
      }),
      this.prisma.foodItem.count({ where }),
    ]);

    return {
      data: items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Detalle ──────────────────────────────────────────────────────────────────

  async findOne(userId: string, foodId: string) {
    const food = await this.prisma.foodItem.findFirst({
      where: {
        id: foodId,
        isActive: true,
        OR: [{ userId: null }, { userId: userId }],
      },
      include: { source: true },
    });
    if (!food) throw new NotFoundException('Alimento no encontrado');
    return food;
  }

  // ── Alimentos personalizados (NUTRITIONIST) ─────────────────────────────────

  async create(userId: string, dto: CreateFoodDto) {
    const customSource = await this.prisma.foodSource.findUnique({
      where: { code: 'CUSTOM' },
    });
    if (!customSource) throw new NotFoundException('Fuente CUSTOM no encontrada');

    return this.prisma.foodItem.create({
      data: {
        sourceId: customSource.id,
        userId,
        name: dto.name,
        nameEs: dto.nameEs ?? dto.name,
        category: dto.category ?? null,
        energy: dto.energy ?? null,
        protein: dto.protein ?? null,
        carbs: dto.carbs ?? null,
        fat: dto.fat ?? null,
        fiber: dto.fiber ?? null,
        sugar: dto.sugar ?? null,
        sodium: dto.sodium ?? null,
        nutrients: dto.nutrients ?? undefined,
      },
      include: { source: true },
    });
  }

  async update(userId: string, foodId: string, dto: Partial<CreateFoodDto>) {
    const food = await this.prisma.foodItem.findFirst({
      where: { id: foodId, userId, isActive: true },
    });
    if (!food) throw new NotFoundException('Alimento no encontrado');

    return this.prisma.foodItem.update({
      where: { id: foodId },
      data: {
        ...dto,
        nameEs: dto.nameEs ?? dto.name ?? food.nameEs,
      },
      include: { source: true },
    });
  }

  async remove(userId: string, foodId: string) {
    const food = await this.prisma.foodItem.findFirst({
      where: { id: foodId, userId, isActive: true },
    });
    if (!food) throw new NotFoundException('Alimento no encontrado');

    await this.prisma.foodItem.update({
      where: { id: foodId },
      data: { isActive: false },
    });
  }

  // ── Categorías disponibles ───────────────────────────────────────────────────

  async getCategories(userId: string) {
    const rows = await this.prisma.foodItem.findMany({
      where: {
        isActive: true,
        category: { not: null },
        OR: [{ userId: null }, { userId }],
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return rows.map(r => r.category).filter(Boolean);
  }
}
