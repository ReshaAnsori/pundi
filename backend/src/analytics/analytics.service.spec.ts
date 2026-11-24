import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from './analytics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: {
    content: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    product: {
      findMany: ReturnType<typeof vi.fn>;
    };
    platform: {
      findMany: ReturnType<typeof vi.fn>;
    };
    commission: {
      findMany: ReturnType<typeof vi.fn>;
    };
    adSpendSnapshot: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      content: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      platform: {
        findMany: vi.fn(),
      },
      commission: {
        findMany: vi.fn(),
      },
      adSpendSnapshot: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('getContentRoi should calculate net profit, ad spend, and return per hour', async () => {
    prisma.content.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Review Termos',
        channel: 'tiktok',
        status: 'published',
        productionHours: 2.0,
        links: [
          {
            commissions: [
              { status: 'valid', amount: 150000 },
              { status: 'pending', amount: 50000 },
            ],
            campaigns: [
              { currentSpend: 40000 },
            ],
          },
        ],
      },
    ]);

    const res = await service.getContentRoi();
    expect(res).toHaveLength(1);
    expect(res[0].totalRevenue).toBe(200000);
    expect(res[0].adSpend).toBe(40000);
    expect(res[0].netProfit).toBe(160000);
    expect(res[0].hourlyReturn).toBe(80000); // 160.000 / 2 jam
    expect(res[0].roiPercent).toBe(400); // (160k / 40k) * 100
  });

  it('getNicheRoi should group products by niche and calculate average revenue', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 10,
        category: 'Dapur & Masak',
        links: [
          {
            commissions: [{ status: 'valid', amount: 90000 }],
          },
        ],
      },
      {
        id: 11,
        category: 'Dapur & Masak',
        links: [
          {
            commissions: [{ status: 'pending', amount: 30000 }],
          },
        ],
      },
    ]);

    const res = await service.getNicheRoi();
    expect(res).toHaveLength(1);
    expect(res[0].niche).toBe('Dapur & Masak');
    expect(res[0].productCount).toBe(2);
    expect(res[0].totalRevenue).toBe(120000);
    expect(res[0].avgRevenuePerProduct).toBe(60000);
  });

  it('getHourlyReturnAnalysis should evaluate overall return against benchmark', async () => {
    prisma.content.findMany.mockResolvedValue([
      {
        id: 1,
        title: 'Video 1',
        channel: 'tiktok',
        status: 'published',
        productionHours: 2.0,
        links: [
          {
            commissions: [{ status: 'valid', amount: 300000 }],
            campaigns: [],
          },
        ],
      },
    ]);

    const res = await service.getHourlyReturnAnalysis();
    expect(res.totalHours).toBe(2.0);
    expect(res.totalNetProfit).toBe(300000);
    expect(res.avgHourlyReturn).toBe(150000);
    expect(res.efficiencyRatio).toBe(3.0); // 150k / 50k benchmark
    expect(res.rating).toBe('Sangat Efisien (Super Star)');
  });

  it('getWeeklyReport should calculate weekly growth and takeaways', async () => {
    prisma.commission.findMany
      .mockResolvedValueOnce([ // current week
        {
          status: 'valid',
          amount: 200000,
          link: {
            content: { id: 1, title: 'Video Viral' },
            product: { category: 'Gadget' },
          },
        },
      ])
      .mockResolvedValueOnce([ // prev week
        { status: 'valid', amount: 100000 },
      ]);

    prisma.content.count.mockResolvedValue(3);
    prisma.adSpendSnapshot.findMany.mockResolvedValue([{ spend: 50000 }]);

    const report = await service.getWeeklyReport();
    expect(report.currentRevenue).toBe(200000);
    expect(report.prevRevenue).toBe(100000);
    expect(report.growthPercent).toBe(100);
    expect(report.adSpendThisWeek).toBe(50000);
    expect(report.netProfitThisWeek).toBe(150000);
    expect(report.topContent?.title).toBe('Video Viral');
    expect(report.topNiche?.name).toBe('Gadget');
    expect(report.takeaways.length).toBeGreaterThan(0);
  });
});
