import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getContentRoi(limit = 50) {
    const contents = await this.prisma.content.findMany({
      take: limit,
      include: {
        links: {
          include: {
            commissions: true,
            campaigns: true,
          },
        },
      },
    });

    const results = contents.map(c => {
      let validCommissions = 0;
      let pendingCommissions = 0;
      let adSpend = 0;

      for (const l of c.links) {
        for (const com of l.commissions) {
          if (com.status === 'valid') validCommissions += com.amount;
          else if (com.status === 'pending') pendingCommissions += com.amount;
        }
        for (const camp of l.campaigns) {
          adSpend += camp.currentSpend;
        }
      }

      const totalRevenue = validCommissions + pendingCommissions;
      const netProfit = totalRevenue - adSpend;
      const hours = c.productionHours || 1.5;
      const hourlyReturn = Math.round(netProfit / hours);
      const roiPercent = adSpend > 0 ? Number(((netProfit / adSpend) * 100).toFixed(1)) : null;

      return {
        contentId: c.id,
        title: c.title,
        channel: c.channel,
        status: c.status,
        productionHours: hours,
        validCommissions,
        pendingCommissions,
        totalRevenue,
        adSpend,
        netProfit,
        hourlyReturn,
        roiPercent,
      };
    });

    return results.sort((a, b) => b.netProfit - a.netProfit);
  }

  async getNicheRoi() {
    const products = await this.prisma.product.findMany({
      include: {
        links: {
          include: {
            commissions: true,
          },
        },
      },
    });

    const nicheMap: Record<
      string,
      {
        niche: string;
        productCount: number;
        linkCount: number;
        validCommissions: number;
        pendingCommissions: number;
        totalRevenue: number;
      }
    > = {};

    for (const p of products) {
      const niche = p.category?.trim() || 'Tanpa Kategori';
      if (!nicheMap[niche]) {
        nicheMap[niche] = {
          niche,
          productCount: 0,
          linkCount: 0,
          validCommissions: 0,
          pendingCommissions: 0,
          totalRevenue: 0,
        };
      }

      nicheMap[niche].productCount++;
      nicheMap[niche].linkCount += p.links.length;

      for (const l of p.links) {
        for (const com of l.commissions) {
          if (com.status === 'valid') {
            nicheMap[niche].validCommissions += com.amount;
            nicheMap[niche].totalRevenue += com.amount;
          } else if (com.status === 'pending') {
            nicheMap[niche].pendingCommissions += com.amount;
            nicheMap[niche].totalRevenue += com.amount;
          }
        }
      }
    }

    const niches = Object.values(nicheMap).map(n => ({
      ...n,
      avgRevenuePerProduct: n.productCount > 0 ? Math.round(n.totalRevenue / n.productCount) : 0,
    }));

    return niches.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  async getPlatformRoi() {
    const platforms = await this.prisma.platform.findMany({
      include: {
        commissions: true,
        products: true,
      },
    });

    return platforms.map(p => {
      let validAmount = 0;
      let pendingAmount = 0;
      let cancelledAmount = 0;
      let totalOrderAmount = 0;

      for (const com of p.commissions) {
        if (com.status === 'valid') validAmount += com.amount;
        else if (com.status === 'pending') pendingAmount += com.amount;
        else if (com.status === 'cancelled') cancelledAmount += com.amount;

        if (com.orderAmount) totalOrderAmount += com.orderAmount;
      }

      const totalRevenue = validAmount + pendingAmount;
      const orderCount = p.commissions.length;
      const avgCommissionPerOrder = orderCount > 0 ? Math.round(totalRevenue / orderCount) : 0;

      return {
        platformId: p.id,
        platformCode: p.code,
        platformName: p.name,
        productCount: p.products.length,
        orderCount,
        validAmount,
        pendingAmount,
        cancelledAmount,
        totalRevenue,
        totalOrderAmount,
        avgCommissionPerOrder,
      };
    });
  }

  async getHourlyReturnAnalysis() {
    const contentRoi = await this.getContentRoi();

    let totalHours = 0;
    let totalRevenue = 0;
    let totalAdSpend = 0;

    for (const c of contentRoi) {
      totalHours += c.productionHours;
      totalRevenue += c.totalRevenue;
      totalAdSpend += c.adSpend;
    }

    const totalNetProfit = totalRevenue - totalAdSpend;
    const avgHourlyReturn = totalHours > 0 ? Math.round(totalNetProfit / totalHours) : 0;
    const benchmark = 50000; // Rp 50.000 / jam
    const efficiencyRatio = Number((avgHourlyReturn / benchmark).toFixed(2));

    let rating = 'Perlu Optimasi';
    if (efficiencyRatio >= 2.0) rating = 'Sangat Efisien (Super Star)';
    else if (efficiencyRatio >= 1.0) rating = 'Efisien (Menguntungkan)';
    else if (efficiencyRatio > 0) rating = 'Cukup (Menghasilkan tapi di bawah UMR/benchmark)';

    return {
      contentCount: contentRoi.length,
      totalHours: Number(totalHours.toFixed(1)),
      totalRevenue,
      totalAdSpend,
      totalNetProfit,
      avgHourlyReturn,
      benchmark,
      efficiencyRatio,
      rating,
      topContentsByHourlyReturn: contentRoi.slice(0, 5),
    };
  }

  async getWeeklyReport(weekOffset = 0) {
    const now = new Date();
    const currentEnd = new Date(now.getTime() - weekOffset * 7 * 24 * 60 * 60 * 1000);
    const currentStart = new Date(currentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(currentStart);
    const prevStart = new Date(prevEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Current week commissions
    const currentCommissions = await this.prisma.commission.findMany({
      where: {
        orderedAt: {
          gte: currentStart,
          lte: currentEnd,
        },
      },
      include: {
        link: {
          include: {
            content: true,
            product: true,
          },
        },
      },
    });

    // Previous week commissions
    const prevCommissions = await this.prisma.commission.findMany({
      where: {
        orderedAt: {
          gte: prevStart,
          lte: prevEnd,
        },
      },
    });

    let currentValid = 0;
    let currentPending = 0;
    const contentRevenueMap: Record<string, { title: string; revenue: number }> = {};
    const nicheRevenueMap: Record<string, number> = {};

    for (const com of currentCommissions) {
      if (com.status === 'valid') currentValid += com.amount;
      else if (com.status === 'pending') currentPending += com.amount;

      if (com.link?.content) {
        const cId = com.link.content.id.toString();
        if (!contentRevenueMap[cId]) {
          contentRevenueMap[cId] = { title: com.link.content.title, revenue: 0 };
        }
        contentRevenueMap[cId].revenue += com.amount;
      }

      const niche = com.link?.product?.category || 'Umum';
      nicheRevenueMap[niche] = (nicheRevenueMap[niche] || 0) + com.amount;
    }

    const currentRevenue = currentValid + currentPending;

    let prevRevenue = 0;
    for (const com of prevCommissions) {
      if (com.status === 'valid' || com.status === 'pending') {
        prevRevenue += com.amount;
      }
    }

    const growthPercent = prevRevenue > 0
      ? Number((((currentRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1))
      : currentRevenue > 0
        ? 100
        : 0;

    // Content published this week
    const contentsPublished = await this.prisma.content.count({
      where: {
        publishedAt: {
          gte: currentStart,
          lte: currentEnd,
        },
      },
    });

    // Ad spend this week
    const spendSnapshots = await this.prisma.adSpendSnapshot.findMany({
      where: {
        recordedAt: {
          gte: currentStart,
          lte: currentEnd,
        },
      },
    });

    const adSpendThisWeek = spendSnapshots.reduce((sum, s) => sum + s.spend, 0);
    const netProfitThisWeek = currentRevenue - adSpendThisWeek;

    // Top performers
    const sortedContents = Object.values(contentRevenueMap).sort((a, b) => b.revenue - a.revenue);
    const sortedNiches = Object.entries(nicheRevenueMap).sort((a, b) => b[1] - a[1]);

    const topContent = sortedContents[0] || null;
    const topNiche = sortedNiches[0] ? { name: sortedNiches[0][0], revenue: sortedNiches[0][1] } : null;

    // Actionable Takeaways
    const takeaways: string[] = [];
    if (growthPercent > 0) {
      takeaways.push(`Pendapatan komisi minggu ini tumbuh +${growthPercent}% dibandingkan minggu lalu.`);
    } else if (growthPercent < 0) {
      takeaways.push(`Pendapatan komisi turun ${Math.abs(growthPercent)}% dibanding minggu sebelumnya. Pertimbangkan menambah variasi konten baru.`);
    } else {
      takeaways.push('Pendapatan stabil dengan minggu sebelumnya.');
    }

    if (topNiche) {
      takeaways.push(`Niche paling menghasilkan minggu ini adalah "${topNiche.name}" dengan omset komisi Rp ${topNiche.revenue.toLocaleString('id-ID')}.`);
    }

    if (netProfitThisWeek > 0) {
      takeaways.push(`Laba bersih operasional (setelah dikurangi spend iklan) positif Rp ${netProfitThisWeek.toLocaleString('id-ID')}.`);
    }

    return {
      period: {
        start: currentStart.toISOString().split('T')[0],
        end: currentEnd.toISOString().split('T')[0],
      },
      currentRevenue,
      currentValid,
      currentPending,
      prevRevenue,
      growthPercent,
      contentsPublished,
      adSpendThisWeek,
      netProfitThisWeek,
      topContent,
      topNiche,
      takeaways,
    };
  }
}
