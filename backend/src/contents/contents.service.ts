import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { UpdateContentDto } from './dto/update-content.dto.js';
import { QueryContentDto } from './dto/query-content.dto.js';

@Injectable()
export class ContentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContentDto) {
    return this.prisma.content.create({
      data: {
        title: dto.title,
        channel: dto.channel,
        status: dto.status ?? 'draft',
        externalUrl: dto.externalUrl,
        publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null,
      },
    });
  }

  async findAll(query?: QueryContentDto) {
    const where: Record<string, unknown> = {};
    if (query?.channel) {
      where.channel = query.channel;
    }
    if (query?.status) {
      where.status = query.status;
    }

    return this.prisma.content.findMany({
      where,
      include: {
        links: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const content = await this.prisma.content.findUnique({
      where: { id },
      include: {
        links: {
          include: {
            product: true,
          },
        },
      },
    });
    if (!content) {
      throw new NotFoundException(`Content with ID ${id} not found`);
    }
    return content;
  }

  async update(id: number, dto: UpdateContentDto) {
    await this.findOne(id);
    return this.prisma.content.update({
      where: { id },
      data: {
        title: dto.title,
        channel: dto.channel,
        status: dto.status,
        externalUrl: dto.externalUrl,
        publishedAt:
          dto.publishedAt !== undefined
            ? dto.publishedAt
              ? new Date(dto.publishedAt)
              : null
            : undefined,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.content.delete({
      where: { id },
    });
  }

  async findLinks(contentId: number) {
    await this.findOne(contentId);
    return this.prisma.affiliateLink.findMany({
      where: { contentId },
      include: {
        product: {
          include: {
            platform: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }
}
