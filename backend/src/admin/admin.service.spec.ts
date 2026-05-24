import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('filters nutritionists by subscription status and includes patient counts', async () => {
    prisma.user.findMany.mockReturnValue('findManyQuery');
    prisma.user.count.mockReturnValue('countQuery');
    prisma.$transaction.mockResolvedValue([
      [
        {
          id: 'user-1',
          email: 'nutri@test.com',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          subscriptionStatus: 'ACTIVE',
          trialEndsAt: null,
          _count: { patients: 3 },
        },
      ],
      1,
    ]);

    const result = await service.getNutritionists({
      page: 1,
      pageSize: 10,
      status: 'ACTIVE',
    } as any);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: {
        role: 'NUTRITIONIST',
        subscriptionStatus: 'ACTIVE',
      },
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        createdAt: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        _count: { select: { patients: true } },
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        role: 'NUTRITIONIST',
        subscriptionStatus: 'ACTIVE',
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(['findManyQuery', 'countQuery']);
    expect(result.meta.total).toBe(1);
  });
});
