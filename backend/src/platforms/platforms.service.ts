import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreatePlatformDto } from './dto/create-platform.dto.js';
import { UpdatePlatformDto } from './dto/update-platform.dto.js';

@Injectable()
export class PlatformsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePlatformDto) {
    const existing = await this.prisma.platform.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Platform with code '${dto.code}' already exists`,
      );
    }
    return this.prisma.platform.create({
      data: {
        code: dto.code,
        name: dto.name,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.platform.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const platform = await this.prisma.platform.findUnique({
      where: { id },
    });
    if (!platform) {
      throw new NotFoundException(`Platform with ID ${id} not found`);
    }
    return platform;
  }

  async update(id: number, dto: UpdatePlatformDto) {
    await this.findOne(id);
    return this.prisma.platform.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.platform.delete({
      where: { id },
    });
  }
}
