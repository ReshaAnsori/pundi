import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContentsService } from './contents.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('ContentsService', () => {
  let service: ContentsService;
  let prisma: {
    content: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    affiliateLink: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      content: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      affiliateLink: {
        findMany: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ContentsService>(ContentsService);
  });

  it('should create content with default status draft', async () => {
    prisma.content.create.mockResolvedValue({
      id: 1,
      title: 'Review Video',
      channel: 'tiktok',
      status: 'draft',
    });

    const result = await service.create({
      title: 'Review Video',
      channel: 'tiktok',
    });
    expect(result.status).toBe('draft');
  });

  it('should throw NotFoundException if content not found on findLinks', async () => {
    prisma.content.findUnique.mockResolvedValue(null);
    await expect(service.findLinks(999)).rejects.toThrow(NotFoundException);
  });
});
