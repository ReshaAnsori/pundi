import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { LinksService } from '../links/links.service.js';
import {
  CreateCampaignDto,
  RecordSpendDto,
  UpsertBudgetRuleDto,
} from './dto/campaign.dto.js';
import { evaluateCampaignRule, EvaluationResult } from './rule-engine.util.js';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly linksService: LinksService,
  ) {}

  async createCampaign(dto: CreateCampaignDto) {
    let linkId = dto.linkId;

    // Requirement: Every ad campaign must have a unique subId for clear conversion tracking
    if (dto.productId && !linkId) {
      const link = await this.linksService.create({
        productId: dto.productId,
      });
      linkId = link.id;
    }

    const platform = dto.platform.toLowerCase();
    if (!['meta', 'tiktok'].includes(platform)) {
      throw new BadRequestException('Platform iklan harus "meta" atau "tiktok"');
    }

    const campaign = await this.prisma.adCampaign.create({
      data: {
        name: dto.name,
        platform,
        dailyBudget: dto.dailyBudget,
        totalBudget: dto.totalBudget,
        linkId,
        notes: dto.notes,
        status: 'active',
      },
      include: {
        link: {
          include: {
            product: true,
          },
        },
      },
    });

    return campaign;
  }

  async listCampaigns(platform?: string, status?: string) {
    const where: any = {};
    if (platform) where.platform = platform.toLowerCase();
    if (status) where.status = status;

    const campaigns = await this.prisma.adCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        link: {
          include: {
            product: true,
            commissions: true,
          },
        },
      },
    });

    return campaigns.map(c => {
      const commissions = c.link?.commissions || [];
      const validCommissions = commissions
        .filter(com => com.status === 'valid')
        .reduce((sum, com) => sum + com.amount, 0);

      const pendingCommissions = commissions
        .filter(com => com.status === 'pending')
        .reduce((sum, com) => sum + com.amount, 0);

      const totalRevenue = validCommissions + pendingCommissions;
      const roas = c.currentSpend > 0 ? totalRevenue / c.currentSpend : 0;
      const netProfit = totalRevenue - c.currentSpend;

      return {
        ...c,
        metrics: {
          validCommissions,
          pendingCommissions,
          totalRevenue,
          roas: Number(roas.toFixed(2)),
          netProfit,
        },
      };
    });
  }

  async getCampaignById(id: number) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: {
        link: {
          include: {
            product: true,
            commissions: true,
          },
        },
        spendSnapshots: {
          orderBy: { recordedAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    const commissions = campaign.link?.commissions || [];
    const validCommissions = commissions
      .filter(com => com.status === 'valid')
      .reduce((sum, com) => sum + com.amount, 0);

    const pendingCommissions = commissions
      .filter(com => com.status === 'pending')
      .reduce((sum, com) => sum + com.amount, 0);

    const totalRevenue = validCommissions + pendingCommissions;
    const roas = campaign.currentSpend > 0 ? totalRevenue / campaign.currentSpend : 0;
    const netProfit = totalRevenue - campaign.currentSpend;

    return {
      ...campaign,
      metrics: {
        validCommissions,
        pendingCommissions,
        totalRevenue,
        roas: Number(roas.toFixed(2)),
        netProfit,
      },
    };
  }

  async recordSpend(id: number, dto: RecordSpendDto) {
    const campaign = await this.prisma.adCampaign.findUnique({
      where: { id },
      include: {
        link: {
          include: {
            commissions: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException(`Campaign with ID ${id} not found`);
    }

    const newSpend = dto.replace
      ? dto.spend
      : campaign.currentSpend + dto.spend;

    // Snapshot spend history
    await this.prisma.adSpendSnapshot.create({
      data: {
        campaignId: id,
        spend: dto.spend,
      },
    });

    // Check rules with new spend
    const commissions = campaign.link?.commissions || [];
    const validCommissions = commissions
      .filter(c => c.status === 'valid')
      .reduce((sum, c) => sum + c.amount, 0);
    const pendingCommissions = commissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + c.amount, 0);

    const evaluation = evaluateCampaignRule({
      campaignId: id,
      createdAt: campaign.createdAt,
      currentSpend: newSpend,
      dailyBudget: campaign.dailyBudget,
      validCommissions,
      pendingCommissions,
    });

    let updatedStatus = campaign.status;
    let pausedReason = campaign.pausedReason;

    if (evaluation.action === 'pause' && campaign.status === 'active') {
      updatedStatus = 'budget_exceeded';
      pausedReason = evaluation.reason;
      this.logger.warn(`Budget Guard triggered for Campaign #${id}: ${evaluation.reason}`);
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id },
      data: {
        currentSpend: newSpend,
        status: updatedStatus,
        pausedReason,
      },
    });

    return {
      campaign: updated,
      evaluation,
    };
  }

  async pauseCampaign(id: number, reason = 'Dijeda secara manual') {
    await this.getCampaignById(id);

    return this.prisma.adCampaign.update({
      where: { id },
      data: {
        status: 'paused',
        pausedReason: reason,
      },
    });
  }

  async resumeCampaign(id: number) {
    await this.getCampaignById(id);

    return this.prisma.adCampaign.update({
      where: { id },
      data: {
        status: 'active',
        pausedReason: null,
      },
    });
  }

  async getBudgetRules() {
    return this.prisma.budgetRule.findMany({
      orderBy: { platform: 'asc' },
    });
  }

  async upsertBudgetRule(dto: UpsertBudgetRuleDto) {
    const platform = dto.platform.toLowerCase();
    return this.prisma.budgetRule.upsert({
      where: { platform },
      create: {
        platform,
        maxDailySpend: dto.maxDailySpend,
        maxMonthlySpend: dto.maxMonthlySpend,
        isActive: dto.isActive ?? true,
      },
      update: {
        maxDailySpend: dto.maxDailySpend,
        maxMonthlySpend: dto.maxMonthlySpend,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  // Budget Guard Cron: runs every 5 minutes
  @Cron('*/5 * * * *')
  async runBudgetGuardCheck(): Promise<{
    timestamp: Date;
    triggeredPauses: number;
    platformBudgetExceeded: string[];
    evaluations: EvaluationResult[];
  }> {
    const activeCampaigns = await this.prisma.adCampaign.findMany({
      where: { status: 'active' },
      include: {
        link: {
          include: {
            commissions: true,
          },
        },
      },
    });

    const budgetRules = await this.prisma.budgetRule.findMany({
      where: { isActive: true },
    });

    const rulesMap = new Map(budgetRules.map(r => [r.platform, r]));
    const platformSpends: Record<string, number> = { meta: 0, tiktok: 0, all: 0 };

    for (const c of activeCampaigns) {
      platformSpends[c.platform] = (platformSpends[c.platform] || 0) + c.currentSpend;
      platformSpends.all += c.currentSpend;
    }

    const platformBudgetExceeded: string[] = [];
    const globalRule = rulesMap.get('all');
    if (globalRule && platformSpends.all >= globalRule.maxDailySpend) {
      platformBudgetExceeded.push('all');
    }

    for (const p of ['meta', 'tiktok']) {
      const pRule = rulesMap.get(p);
      if (pRule && platformSpends[p] >= pRule.maxDailySpend) {
        platformBudgetExceeded.push(p);
      }
    }

    let triggeredPauses = 0;
    const evaluations: EvaluationResult[] = [];

    for (const c of activeCampaigns) {
      // Check platform-wide hard cap
      if (
        platformBudgetExceeded.includes('all') ||
        platformBudgetExceeded.includes(c.platform)
      ) {
        await this.prisma.adCampaign.update({
          where: { id: c.id },
          data: {
            status: 'budget_exceeded',
            pausedReason: `Platform budget limit reached for ${c.platform.toUpperCase()}`,
          },
        });
        triggeredPauses++;
        continue;
      }

      // Check per-campaign rules (observation window + valid+pending commission ROAS)
      const commissions = c.link?.commissions || [];
      const validCommissions = commissions
        .filter(com => com.status === 'valid')
        .reduce((sum, com) => sum + com.amount, 0);
      const pendingCommissions = commissions
        .filter(com => com.status === 'pending')
        .reduce((sum, com) => sum + com.amount, 0);

      const evaluation = evaluateCampaignRule({
        campaignId: c.id,
        createdAt: c.createdAt,
        currentSpend: c.currentSpend,
        dailyBudget: c.dailyBudget,
        validCommissions,
        pendingCommissions,
      });

      evaluations.push(evaluation);

      if (evaluation.action === 'pause') {
        await this.prisma.adCampaign.update({
          where: { id: c.id },
          data: {
            status: 'budget_exceeded',
            pausedReason: evaluation.reason,
          },
        });
        triggeredPauses++;
        this.logger.warn(
          `Budget Guard auto-paused campaign ${c.name} (ID: ${c.id}): ${evaluation.reason}`,
        );
      }
    }

    return {
      timestamp: new Date(),
      triggeredPauses,
      platformBudgetExceeded,
      evaluations,
    };
  }

  async getSummary() {
    const campaigns = await this.listCampaigns();

    let totalSpend = 0;
    let totalValid = 0;
    let totalPending = 0;
    let activeCount = 0;
    let pausedCount = 0;

    for (const c of campaigns) {
      totalSpend += c.currentSpend;
      totalValid += c.metrics.validCommissions;
      totalPending += c.metrics.pendingCommissions;
      if (c.status === 'active') activeCount++;
      else pausedCount++;
    }

    const totalRevenue = totalValid + totalPending;
    const netProfit = totalRevenue - totalSpend;
    const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

    return {
      totalSpend,
      totalValidCommissions: totalValid,
      totalPendingCommissions: totalPending,
      totalRevenue,
      netProfit,
      overallRoas: Number(overallRoas.toFixed(2)),
      activeCampaigns: activeCount,
      pausedCampaigns: pausedCount,
      campaignsCount: campaigns.length,
    };
  }
}
