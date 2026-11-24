import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CommissionsService } from './commissions.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('CommissionsService', () => {
  let service: CommissionsService;
  let prisma: {
    commission: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      commission: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommissionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommissionsService>(CommissionsService);
  });

  it('should calculate summary in integer rupiah', async () => {
    prisma.commission.findMany.mockResolvedValue([
      { status: 'valid', amount: 15000, orderAmount: 150000 },
      { status: 'pending', amount: 20000, orderAmount: 200000 },
      { status: 'cancelled', amount: 5000, orderAmount: 50000 },
    ]);

    const summary = await service.getSummary();
    expect(summary.totalCount).toBe(3);
    expect(summary.totalValid).toBe(15000);
    expect(summary.totalPending).toBe(20000);
    expect(summary.totalCancelled).toBe(5000);
    expect(summary.totalOrderAmount).toBe(400000);
  });

  it('should throw NotFoundException if commission not found by id', async () => {
    prisma.commission.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });
});
