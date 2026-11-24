import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryRecommendationsDto } from './dto/query-recommendations.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { calculateProductScore } from './scoring.util.js';

@Injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateAndSaveScores(platformId?: number): Promise<{ scoredCount: number }> {
    const where: Record<string, unknown> = {};
    if (platformId) {
      where.platformId = platformId;
    }

    const products = await this.prisma.product.findMany({ where });

    let scoredCount = 0;
    for (const product of products) {
      const { score, breakdown } = calculateProductScore({
        price: product.price,
        commissionRate: product.commissionRate,
        rating: product.rating,
        soldCount: product.soldCount,
      });

      await this.prisma.productScore.upsert({
        where: { productId: product.id },
        create: {
          productId: product.id,
          score,
          status: 'new',
          breakdown: JSON.stringify(breakdown),
        },
        update: {
          score,
          breakdown: JSON.stringify(breakdown),
        },
      });

      scoredCount++;
    }

    return { scoredCount };
  }

  async getRecommendations(query?: QueryRecommendationsDto) {
    // If no scores exist in DB, auto-calculate once
    const totalScores = await this.prisma.productScore.count();
    if (totalScores === 0) {
      await this.calculateAndSaveScores();
    }

    const where: Record<string, unknown> = {};

    if (query?.minScore !== undefined) {
      where.score = { gte: query.minScore };
    }

    if (query?.status && query.status !== 'all') {
      where.status = query.status;
    } else if (!query?.status) {
      // By default, exclude skipped products
      where.status = { not: 'skipped' };
    }

    const productWhere: Record<string, unknown> = {};
    if (query?.platformId) {
      productWhere.platformId = query.platformId;
    }
    if (query?.category) {
      productWhere.category = query.category;
    }
    if (query?.minPrice !== undefined || query?.maxPrice !== undefined) {
      productWhere.price = {
        gte: query?.minPrice ?? undefined,
        lte: query?.maxPrice ?? undefined,
      };
    }

    if (Object.keys(productWhere).length > 0) {
      where.product = productWhere;
    }

    const limit = query?.limit ?? 20;

    const scores = await this.prisma.productScore.findMany({
      where,
      include: {
        product: {
          include: {
            platform: true,
            links: true,
          },
        },
      },
      orderBy: { score: 'desc' },
      take: limit,
    });

    return scores.map((s) => ({
      id: s.id,
      productId: s.productId,
      score: s.score,
      status: s.status,
      notes: s.notes,
      breakdown: s.breakdown ? JSON.parse(s.breakdown) : null,
      scoredAt: s.scoredAt,
      product: s.product,
    }));
  }

  async updateProductStatus(
    productId: number,
    dto: UpdateProductStatusDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const { score, breakdown } = calculateProductScore({
      price: product.price,
      commissionRate: product.commissionRate,
      rating: product.rating,
      soldCount: product.soldCount,
    });

    return this.prisma.productScore.upsert({
      where: { productId },
      create: {
        productId,
        score,
        status: dto.status,
        notes: dto.notes,
        breakdown: JSON.stringify(breakdown),
      },
      update: {
        status: dto.status,
        notes: dto.notes !== undefined ? dto.notes : undefined,
      },
      include: {
        product: {
          include: {
            platform: true,
          },
        },
      },
    });
  }

  async getCategories(): Promise<string[]> {
    const products = await this.prisma.product.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
    });

    return products
      .map((p) => p.category as string)
      .filter((c) => c && c.trim().length > 0);
  }
}
