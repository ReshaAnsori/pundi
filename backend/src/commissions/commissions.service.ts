import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueryCommissionsDto } from './dto/query-commissions.dto.js';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query?: QueryCommissionsDto) {
    const where: Record<string, unknown> = {};

    if (query?.platformId) {
      where.platformId = query.platformId;
    }
    if (query?.status) {
      where.status = query.status;
    }
    if (query?.linkId) {
      where.linkId = query.linkId;
    }
    if (query?.subId) {
      where.link = {
        subId: query.subId,
      };
    }

    return this.prisma.commission.findMany({
      where,
      include: {
        platform: true,
        link: {
          include: {
            product: true,
            content: true,
          },
        },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: {
        platform: true,
        link: {
          include: {
            product: true,
            content: true,
          },
        },
      },
    });
    if (!commission) {
      throw new NotFoundException(`Commission with ID ${id} not found`);
    }
    return commission;
  }

  async getSummary() {
    const commissions = await this.prisma.commission.findMany({
      select: {
        status: true,
        amount: true,
        orderAmount: true,
      },
    });

    let totalValid = 0;
    let totalPending = 0;
    let totalCancelled = 0;
    let totalOrderAmount = 0;

    for (const c of commissions) {
      totalOrderAmount += c.orderAmount ?? 0;
      if (c.status === 'valid') {
        totalValid += c.amount;
      } else if (c.status === 'cancelled') {
        totalCancelled += c.amount;
      } else {
        totalPending += c.amount;
      }
    }

    return {
      totalCount: commissions.length,
      totalValid,
      totalPending,
      totalCancelled,
      totalOrderAmount,
    };
  }
}
