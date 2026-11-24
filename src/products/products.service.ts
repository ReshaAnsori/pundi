import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductDto } from './dto/query-product.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const platform = await this.prisma.platform.findUnique({
      where: { id: dto.platformId },
    });
    if (!platform) {
      throw new NotFoundException(
        `Platform with ID ${dto.platformId} not found`,
      );
    }

    const existing = await this.prisma.product.findUnique({
      where: {
        platformId_externalId: {
          platformId: dto.platformId,
          externalId: dto.externalId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Product with externalId '${dto.externalId}' already exists for platform ID ${dto.platformId}`,
      );
    }

    return this.prisma.product.create({
      data: dto,
      include: {
        platform: true,
      },
    });
  }

  async findAll(query?: QueryProductDto) {
    const where: Record<string, unknown> = {};

    if (query?.platformId) {
      where.platformId = query.platformId;
    }
    if (query?.category) {
      where.category = query.category;
    }
    if (query?.search) {
      where.name = {
        contains: query.search,
      };
    }

    return this.prisma.product.findMany({
      where,
      include: {
        platform: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        platform: true,
      },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: {
        platform: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.product.delete({
      where: { id },
    });
  }
}
