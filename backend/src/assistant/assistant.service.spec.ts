import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AssistantService } from './assistant.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LinksService } from '../links/links.service.js';

describe('AssistantService', () => {
  let service: AssistantService;
  let prisma: {
    product: { findUnique: ReturnType<typeof vi.fn> };
    content: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };
  let linksService: {
    create: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    prisma = {
      product: { findUnique: vi.fn() },
      content: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    linksService = {
      create: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssistantService,
        { provide: PrismaService, useValue: prisma },
        { provide: LinksService, useValue: linksService },
      ],
    }).compile();

    service = module.get<AssistantService>(AssistantService);
  });

  it('should throw NotFoundException if product is missing', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.generate({ productId: 999 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should generate hooks, script, caption, and hashtags passing guardrails', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 1,
      name: 'Panci Listrik Mini',
      price: 80000,
      category: 'Dapur',
      platform: { name: 'Shopee' },
    });

    const output = await service.generate({ productId: 1, angle: 'unboxing' });
    expect(output.hooks).toHaveLength(3);
    expect(output.shortScript).toContain('[0-3s Hook]');
    expect(output.shortScript).toContain('[22-30s Call To Action]');
    expect(output.caption).toContain('Panci Listrik Mini');
    expect(output.hashtags.length).toBeGreaterThanOrEqual(3);
    expect(output.guardrailsCheck.passed).toBe(true);
  });

  it('generateAndSaveDraft should strictly enforce status draft and attach affiliate link', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 1,
      name: 'Panci Listrik Mini',
      price: 80000,
      category: 'Dapur',
      platform: { name: 'Shopee' },
    });

    prisma.content.create.mockResolvedValue({
      id: 10,
      title: '[Draft AI] Review Panci',
      channel: 'tiktok',
      status: 'draft',
    });

    linksService.create.mockResolvedValue({
      id: 50,
      subId: 'c10_p1_abc123',
      trackingUrl: 'https://shopee.co.id/product?sub_id=c10_p1_abc123',
    });

    const res = await service.generateAndSaveDraft({
      productId: 1,
      channel: 'tiktok',
    });

    expect(res.content.status).toBe('draft');
    expect(prisma.content.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'draft',
        }),
      }),
    );
    expect(linksService.create).toHaveBeenCalledWith({
      productId: 1,
      contentId: 10,
    });
  });

  it('reviewAndPublish should transition status from draft to published', async () => {
    prisma.content.findUnique.mockResolvedValue({ id: 10, status: 'draft' });
    prisma.content.update.mockResolvedValue({ id: 10, status: 'published' });

    const updated = await service.reviewAndPublish(10);
    expect(updated.status).toBe('published');
    expect(prisma.content.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          status: 'published',
        }),
      }),
    );
  });
});
