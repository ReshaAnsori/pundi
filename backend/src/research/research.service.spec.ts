import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ResearchService } from './research.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ResearchService', () => {
  let service: ResearchService;
  let prisma: {
    product: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
    productScore: {
      count: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      upsert: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
      },
      productScore: {
        count: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ResearchService>(ResearchService);
  });

  it('should calculate and save scores for all products', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        price: 75000,
        commissionRate: 12,
        rating: 4.8,
        soldCount: 2000,
      },
    ]);
    prisma.productScore.upsert.mockResolvedValue({ id: 10 });

    const result = await service.calculateAndSaveScores();
    expect(result.scoredCount).toBe(1);
    expect(prisma.productScore.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 1 },
      }),
    );
  });

  it('should throw NotFoundException when updating status of non-existent product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(
      service.updateProductStatus(999, { status: 'shortlisted' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update status to shortlisted for an existing product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 2,
      price: 100000,
      commissionRate: 15,
      rating: 4.9,
      soldCount: 5000,
    });
    prisma.productScore.upsert.mockResolvedValue({
      id: 20,
      productId: 2,
      status: 'shortlisted',
    });

    const res = await service.updateProductStatus(2, {
      status: 'shortlisted',
      notes: 'Bagus untuk niche dapur',
    });
    expect(res.status).toBe('shortlisted');
  });
});
