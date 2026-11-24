import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlatformAdapterRegistry } from '../platforms/platform-adapter.registry.js';
import { AffiliatePlatform } from '../platforms/affiliate-platform.interface.js';

describe('SyncService', () => {
  let service: SyncService;
  let prisma: {
    platform: { findUnique: ReturnType<typeof vi.fn> };
    syncRun: { create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    affiliateLink: { findUnique: ReturnType<typeof vi.fn> };
    commission: { upsert: ReturnType<typeof vi.fn> };
  };
  let registry: PlatformAdapterRegistry;
  let mockAdapter: AffiliatePlatform;

  beforeEach(async () => {
    prisma = {
      platform: { findUnique: vi.fn() },
      syncRun: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1, status: 'ok', recordsUpserted: 1 }),
      },
      affiliateLink: { findUnique: vi.fn() },
      commission: { upsert: vi.fn().mockResolvedValue({ id: 10 }) },
    };

    mockAdapter = {
      platformCode: 'shopee',
      buildLink: vi.fn(),
      fetchCommissions: vi.fn().mockResolvedValue([
        {
          orderExternalId: 'ORD-123',
          productExternalId: 'PROD-456',
          status: 'valid',
          amount: 25000,
          orderedAt: new Date(),
          subId: 'c1_p2_abc',
        },
      ]),
      parseCommissionCsv: vi.fn().mockReturnValue([
        {
          orderExternalId: 'ORD-123',
          productExternalId: 'PROD-456',
          status: 'valid',
          amount: 25000,
          orderedAt: new Date(),
          subId: 'c1_p2_abc',
        },
      ]),
    };

    registry = new PlatformAdapterRegistry();
    registry.register(mockAdapter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: PlatformAdapterRegistry, useValue: registry },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('should throw NotFoundException if platform does not exist in DB', async () => {
    prisma.platform.findUnique.mockResolvedValue(null);
    await expect(service.syncPlatform('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should sync platform commissions and map subId to affiliateLink', async () => {
    prisma.platform.findUnique.mockResolvedValue({ id: 1, code: 'shopee' });
    prisma.affiliateLink.findUnique.mockResolvedValue({ id: 5, subId: 'c1_p2_abc' });

    const result = await service.syncPlatform('shopee');

    expect(result.status).toBe('ok');
    expect(result.recordsUpserted).toBe(1);
    expect(prisma.commission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          platformId_orderExternalId_productExternalId: {
            platformId: 1,
            orderExternalId: 'ORD-123',
            productExternalId: 'PROD-456',
          },
        },
        create: expect.objectContaining({
          linkId: 5,
          amount: 25000,
          status: 'valid',
        }),
      }),
    );
  });
});
