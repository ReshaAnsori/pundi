import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { QueryLinkDto } from './dto/query-link.dto.js';

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLinkDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { platform: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    if (dto.contentId !== undefined && dto.contentId !== null) {
      const content = await this.prisma.content.findUnique({
        where: { id: dto.contentId },
      });
      if (!content) {
        throw new NotFoundException(
          `Content with ID ${dto.contentId} not found`,
        );
      }
    }

    let subId = dto.customSubId;
    if (subId) {
      const existing = await this.prisma.affiliateLink.findUnique({
        where: { subId },
      });
      if (existing) {
        throw new ConflictException(`subId '${subId}' is already in use`);
      }
    } else {
      subId = await this.generateUniqueSubId(dto.productId, dto.contentId);
    }

    const trackingUrl =
      dto.trackingUrl ?? this.buildDefaultTrackingUrl(product.url, subId);

    return this.prisma.affiliateLink.create({
      data: {
        productId: dto.productId,
        contentId: dto.contentId,
        subId,
        trackingUrl,
      },
      include: {
        product: {
          include: { platform: true },
        },
        content: true,
      },
    });
  }

  private async generateUniqueSubId(
    productId: number,
    contentId?: number,
  ): Promise<string> {
    const prefix = contentId ? `c${contentId}_p${productId}` : `p${productId}`;
    let attempts = 0;
    while (attempts < 5) {
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const candidate = `${prefix}_${randomSuffix}`;
      const existing = await this.prisma.affiliateLink.findUnique({
        where: { subId: candidate },
      });
      if (!existing) {
        return candidate;
      }
      attempts++;
    }
    return `${prefix}_${Date.now()}`;
  }

  private buildDefaultTrackingUrl(
    productUrl: string | null,
    subId: string,
  ): string {
    if (!productUrl) {
      return `https://pundi.local/track/${subId}`;
    }
    try {
      const parsed = new URL(productUrl);
      parsed.searchParams.set('sub_id', subId);
      return parsed.toString();
    } catch {
      const separator = productUrl.includes('?') ? '&' : '?';
      return `${productUrl}${separator}sub_id=${encodeURIComponent(subId)}`;
    }
  }

  async findAll(query?: QueryLinkDto) {
    const where: Record<string, unknown> = {};
    if (query?.productId) {
      where.productId = query.productId;
    }
    if (query?.contentId) {
      where.contentId = query.contentId;
    }

    return this.prisma.affiliateLink.findMany({
      where,
      include: {
        product: {
          include: { platform: true },
        },
        content: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { id },
      include: {
        product: {
          include: { platform: true },
        },
        content: true,
      },
    });
    if (!link) {
      throw new NotFoundException(`Affiliate link with ID ${id} not found`);
    }
    return link;
  }

  async findBySubId(subId: string) {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { subId },
      include: {
        product: {
          include: { platform: true },
        },
        content: true,
      },
    });
    if (!link) {
      throw new NotFoundException(
        `Affiliate link with subId '${subId}' not found`,
      );
    }
    return link;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.affiliateLink.delete({
      where: { id },
    });
  }
}
