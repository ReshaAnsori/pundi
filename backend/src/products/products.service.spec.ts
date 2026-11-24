import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    platform: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    product: {
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
      },
      product: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should throw NotFoundException if platform does not exist when creating product', async () => {
    prisma.platform.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        platformId: 99,
        externalId: 'ext-1',
        name: 'Item 1',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ConflictException if product already exists for platform', async () => {
    prisma.platform.findUnique.mockResolvedValue({ id: 1 });
    prisma.product.findUnique.mockResolvedValue({ id: 10 });

    await expect(
      service.create({
        platformId: 1,
        externalId: 'ext-1',
        name: 'Item 1',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should create product successfully', async () => {
    prisma.platform.findUnique.mockResolvedValue({ id: 1 });
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue({
      id: 10,
      platformId: 1,
      externalId: 'ext-1',
      name: 'Item 1',
    });

    const result = await service.create({
      platformId: 1,
      externalId: 'ext-1',
      name: 'Item 1',
    });
    expect(result.id).toBe(10);
  });
});
