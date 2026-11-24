import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    commission: {
      findMany: ReturnType<typeof vi.fn>;
    };
    syncRun: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      commission: {
        findMany: vi.fn(),
      },
      syncRun: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should calculate summary with platform breakdown', async () => {
    prisma.commission.findMany.mockResolvedValue([
      {
        status: 'valid',
        amount: 25000,
        orderAmount: 200000,
        platform: { code: 'shopee', name: 'Shopee' },
      },
      {
        status: 'pending',
        amount: 10000,
        orderAmount: 100000,
        platform: { code: 'shopee', name: 'Shopee' },
      },
      {
        status: 'valid',
        amount: 30000,
        orderAmount: 300000,
        platform: { code: 'tiktok', name: 'TikTok Shop' },
      },
    ]);

    const summary = await service.getSummary({ period: '7d' });
    expect(summary.totalCount).toBe(3);
    expect(summary.totalValid).toBe(55000);
    expect(summary.totalPending).toBe(10000);
    expect(summary.totalOrderAmount).toBe(600000);
    expect(summary.platforms).toHaveLength(2);

    const shopee = summary.platforms.find((p) => p.platformCode === 'shopee');
    expect(shopee?.validAmount).toBe(25000);
    expect(shopee?.pendingAmount).toBe(10000);
    expect(shopee?.orderCount).toBe(2);
  });

  it('should rank top contents by commission correctly', async () => {
    prisma.commission.findMany.mockResolvedValue([
      {
        status: 'valid',
        amount: 50000,
        link: {
          content: { id: 1, title: 'Content A', channel: 'tiktok', status: 'published' },
        },
      },
      {
        status: 'valid',
        amount: 20000,
        link: {
          content: { id: 2, title: 'Content B', channel: 'instagram', status: 'published' },
        },
      },
      {
        status: 'valid',
        amount: 30000,
        link: {
          content: { id: 2, title: 'Content B', channel: 'instagram', status: 'published' },
        },
      },
    ]);

    const topContents = await service.getTopContents();
    expect(topContents).toHaveLength(2);
    // Content B has 20000 + 30000 = 50000
    // Content A has 50000
    expect(topContents[0].totalCommission).toBe(50000);
    expect(topContents[1].totalCommission).toBe(50000);
  });
});
