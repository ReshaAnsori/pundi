import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LinksService } from './links.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('LinksService', () => {
  let service: LinksService;
  let prisma: {
    product: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    content: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    affiliateLink: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: vi.fn(),
      },
      content: {
        findUnique: vi.fn(),
      },
      affiliateLink: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinksService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<LinksService>(LinksService);
  });

  it('should throw NotFoundException if product does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.create({ productId: 999 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException if contentId does not exist', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 1, url: 'https://shopee.co.id/item' });
    prisma.content.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ productId: 1, contentId: 999 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should generate unique subId and append to trackingUrl', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 1,
      url: 'https://shopee.co.id/product-123',
    });
    prisma.content.findUnique.mockResolvedValue({ id: 2 });
    prisma.affiliateLink.findUnique.mockResolvedValue(null);
    prisma.affiliateLink.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 100, ...data }),
    );

    const result = await service.create({ productId: 1, contentId: 2 });
    expect(result.subId).toMatch(/^c2_p1_[a-f0-9]{8}$/);
    expect(result.trackingUrl).toContain('sub_id=c2_p1_');
  });

  it('should throw ConflictException if custom subId already exists', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 1 });
    prisma.affiliateLink.findUnique.mockResolvedValue({ id: 5, subId: 'taken' });

    await expect(
      service.create({ productId: 1, customSubId: 'taken' }),
    ).rejects.toThrow(ConflictException);
  });
});
