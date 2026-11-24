import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdsService } from './ads.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LinksService } from '../links/links.service.js';

describe('AdsService', () => {
  let service: AdsService;
  let prisma: {
    adCampaign: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    budgetRule: {
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
    adSpendSnapshot: {
      create: ReturnType<typeof vi.fn>;
    };
  };
  let linksService: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      adCampaign: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      budgetRule: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      adSpendSnapshot: {
        create: vi.fn(),
      },
    };

    linksService = {
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: LinksService,
          useValue: linksService,
        },
      ],
    }).compile();

    service = module.get<AdsService>(AdsService);
  });

  it('should auto-generate affiliate link with unique subId if productId provided', async () => {
    linksService.create.mockResolvedValue({ id: 88, subId: 'p1_ad_12345' });
    prisma.adCampaign.create.mockResolvedValue({
      id: 1,
      name: 'Iklan Termos TikTok',
      platform: 'tiktok',
      dailyBudget: 50000,
      linkId: 88,
      status: 'active',
    });

    const result = await service.createCampaign({
      name: 'Iklan Termos TikTok',
      platform: 'tiktok',
      dailyBudget: 50000,
      productId: 1,
    });

    expect(linksService.create).toHaveBeenCalledWith({ productId: 1 });
    expect(result.linkId).toBe(88);
  });

  it('should throw BadRequestException if platform is invalid', async () => {
    await expect(
      service.createCampaign({
        name: 'Invalid Platform Campaign',
        platform: 'twitter',
        dailyBudget: 50000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('recordSpend should snapshot spend and auto-pause when daily budget exceeded', async () => {
    const mockCampaign = {
      id: 5,
      createdAt: new Date(),
      dailyBudget: 100000,
      currentSpend: 80000,
      status: 'active',
      pausedReason: null,
      link: {
        commissions: [],
      },
    };

    prisma.adCampaign.findUnique.mockResolvedValue(mockCampaign);
    prisma.adSpendSnapshot.create.mockResolvedValue({ id: 1 });
    prisma.adCampaign.update.mockResolvedValue({
      ...mockCampaign,
      currentSpend: 110000,
      status: 'budget_exceeded',
      pausedReason: 'Batas budget harian',
    });

    const res = await service.recordSpend(5, { spend: 30000 });
    expect(res.campaign.status).toBe('budget_exceeded');
    expect(res.evaluation.action).toBe('pause');
  });

  it('runBudgetGuardCheck should auto-pause campaigns when platform-wide budget cap exceeded', async () => {
    const activeCampaigns = [
      {
        id: 1,
        platform: 'meta',
        currentSpend: 150000,
        dailyBudget: 200000,
        status: 'active',
        createdAt: new Date(),
        link: { commissions: [] },
      },
    ];

    const budgetRules = [
      {
        platform: 'meta',
        maxDailySpend: 100000, // spend 150k > rule 100k
        maxMonthlySpend: 3000000,
        isActive: true,
      },
    ];

    prisma.adCampaign.findMany.mockResolvedValue(activeCampaigns);
    prisma.budgetRule.findMany.mockResolvedValue(budgetRules);
    prisma.adCampaign.update.mockResolvedValue({});

    const report = await service.runBudgetGuardCheck();
    expect(report.triggeredPauses).toBe(1);
    expect(report.platformBudgetExceeded).toContain('meta');
  });
});
