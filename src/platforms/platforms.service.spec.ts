import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlatformsService } from './platforms.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('PlatformsService', () => {
  let service: PlatformsService;
  let prisma: {
    platform: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      platform: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<PlatformsService>(PlatformsService);
  });

  it('should create a platform', async () => {
    prisma.platform.findUnique.mockResolvedValue(null);
    prisma.platform.create.mockResolvedValue({
      id: 1,
      code: 'shopee',
      name: 'Shopee',
      isActive: true,
    });

    const result = await service.create({ code: 'shopee', name: 'Shopee' });
    expect(result.id).toBe(1);
    expect(result.code).toBe('shopee');
  });

  it('should throw ConflictException if platform code exists', async () => {
    prisma.platform.findUnique.mockResolvedValue({ id: 1, code: 'shopee' });

    await expect(
      service.create({ code: 'shopee', name: 'Shopee' }),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException if platform not found on findOne', async () => {
    prisma.platform.findUnique.mockResolvedValue(null);
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });
});
