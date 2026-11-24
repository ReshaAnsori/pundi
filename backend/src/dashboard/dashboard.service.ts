import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryDashboardDto } from './dto/query-dashboard.dto.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveDateFilter(query?: QueryDashboardDto): {
    gte?: Date;
    lte?: Date;
  } {
    if (query?.startDate || query?.endDate) {
      return {
        gte: query.startDate ? new Date(query.startDate) : undefined,
        lte: query.endDate ? new Date(query.endDate) : undefined,
      };
    }

    const now = new Date();
    if (query?.period === 'today') {
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      return { gte: startOfDay };
    }
    if (query?.period === '7d') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { gte: sevenDaysAgo };
    }
    if (query?.period === '30d') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { gte: thirtyDaysAgo };
    }
    return {};
  }

  async getSummary(query?: QueryDashboardDto) {
    const dateFilter = this.resolveDateFilter(query);
    const where: Record<string, unknown> = {};
    if (dateFilter.gte || dateFilter.lte) {
      where.orderedAt = dateFilter;
    }

    const commissions = await this.prisma.commission.findMany({
      where,
      include: {
        platform: true,
      },
    });

    let totalValid = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    let totalOrderAmount = 0;

    const platformBreakdown: Record<
      string,
      {
        platformCode: string;
        platformName: string;
        validAmount: number;
        pendingAmount: number;
        cancelledAmount: number;
        orderCount: number;
      }
    > = {};

    for (const c of commissions) {
      totalOrderAmount += c.orderAmount ?? 0;
      if (c.status === 'valid') {
        totalValid += c.amount;
      } else if (c.status === 'cancelled') {
        totalCancelled += c.amount;
      } else {
        totalPending += c.amount;
      }

      const pCode = c.platform.code;
      if (!platformBreakdown[pCode]) {
        platformBreakdown[pCode] = {
          platformCode: pCode,
          platformName: c.platform.name,
          validAmount: 0,
          pendingAmount: 0,
          cancelledAmount: 0,
          orderCount: 0,
        };
      }

      platformBreakdown[pCode].orderCount++;
      if (c.status === 'valid') {
        platformBreakdown[pCode].validAmount += c.amount;
      } else if (c.status === 'cancelled') {
        platformBreakdown[pCode].cancelledAmount += c.amount;
      } else {
        platformBreakdown[pCode].pendingAmount += c.amount;
      }
    }

    return {
      period: query?.period ?? 'all',
      totalCount: commissions.length,
      totalValid,
      totalPending,
      totalCancelled,
      totalOrderAmount,
      platforms: Object.values(platformBreakdown),
    };
  }

  async getTopContents(query?: QueryDashboardDto) {
    const dateFilter = this.resolveDateFilter(query);
    const where: Record<string, unknown> = {
      linkId: { not: null },
    };
    if (dateFilter.gte || dateFilter.lte) {
      where.orderedAt = dateFilter;
    }

    const commissions = await this.prisma.commission.findMany({
      where,
      include: {
        link: {
          include: {
            content: true,
          },
        },
      },
    });

    const contentMap = new Map<
      number,
      {
        contentId: number;
        title: string;
        channel: string;
        status: string;
        validCommission: number;
        pendingCommission: number;
        totalCommission: number;
        orderCount: number;
      }
    >();

    for (const c of commissions) {
      const content = c.link?.content;
      if (!content) {
        continue;
      }

      let item = contentMap.get(content.id);
      if (!item) {
        item = {
          contentId: content.id,
          title: content.title,
          channel: content.channel,
          status: content.status,
          validCommission: 0,
          pendingCommission: 0,
          totalCommission: 0,
          orderCount: 0,
        };
        contentMap.set(content.id, item);
      }

      item.orderCount++;
      if (c.status === 'valid') {
        item.validCommission += c.amount;
        item.totalCommission += c.amount;
      } else if (c.status === 'pending') {
        item.pendingCommission += c.amount;
        item.totalCommission += c.amount;
      }
    }

    const sorted = Array.from(contentMap.values()).sort(
      (a, b) => b.validCommission - a.validCommission || b.totalCommission - a.totalCommission,
    );

    const limit = query?.limit ?? 10;
    return sorted.slice(0, limit);
  }

  async getTopProducts(query?: QueryDashboardDto) {
    const dateFilter = this.resolveDateFilter(query);
    const where: Record<string, unknown> = {
      linkId: { not: null },
    };
    if (dateFilter.gte || dateFilter.lte) {
      where.orderedAt = dateFilter;
    }

    const commissions = await this.prisma.commission.findMany({
      where,
      include: {
        platform: true,
        link: {
          include: {
            product: true,
          },
        },
      },
    });

    const productMap = new Map<
      number,
      {
        productId: number;
        productName: string;
        platformName: string;
        validCommission: number;
        pendingCommission: number;
        totalCommission: number;
        orderCount: number;
      }
    >();

    for (const c of commissions) {
      const product = c.link?.product;
      if (!product) {
        continue;
      }

      let item = productMap.get(product.id);
      if (!item) {
        item = {
          productId: product.id,
          productName: product.name,
          platformName: c.platform.name,
          validCommission: 0,
          pendingCommission: 0,
          totalCommission: 0,
          orderCount: 0,
        };
        productMap.set(product.id, item);
      }

      item.orderCount++;
      if (c.status === 'valid') {
        item.validCommission += c.amount;
        item.totalCommission += c.amount;
      } else if (c.status === 'pending') {
        item.pendingCommission += c.amount;
        item.totalCommission += c.amount;
      }
    }

    const sorted = Array.from(productMap.values()).sort(
      (a, b) => b.validCommission - a.validCommission || b.totalCommission - a.totalCommission,
    );

    const limit = query?.limit ?? 10;
    return sorted.slice(0, limit);
  }

  async getRecentActivity() {
    const [recentSyncs, recentCommissions] = await Promise.all([
      this.prisma.syncRun.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        include: { platform: true },
      }),
      this.prisma.commission.findMany({
        take: 10,
        orderBy: { orderedAt: 'desc' },
        include: {
          platform: true,
          link: {
            include: {
              product: true,
              content: true,
            },
          },
        },
      }),
    ]);

    return {
      recentSyncs,
      recentCommissions,
    };
  }
}
