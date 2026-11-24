import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let prisma: {
    content: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    postingSchedule: {
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      groupBy: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      content: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      postingSchedule: {
        count: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        groupBy: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
  });

  it('should throw NotFoundException if content does not exist', async () => {
    prisma.content.findUnique.mockResolvedValue(null);

    await expect(
      service.createSchedule({
        contentId: 999,
        scheduledFor: new Date().toISOString(),
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should create schedule and update content to scheduled', async () => {
    const mockContent = {
      id: 1,
      title: 'Video Unboxing',
      channel: 'tiktok',
      status: 'draft',
      links: [],
    };
    prisma.content.findUnique.mockResolvedValue(mockContent);
    prisma.postingSchedule.count.mockResolvedValue(1); // 1 post existing today
    const mockSchedule = {
      id: 10,
      contentId: 1,
      channel: 'tiktok',
      scheduledFor: new Date(),
      status: 'pending',
    };
    prisma.postingSchedule.create.mockResolvedValue(mockSchedule);
    prisma.content.update.mockResolvedValue({ ...mockContent, status: 'scheduled' });

    const result = await service.createSchedule({
      contentId: 1,
      scheduledFor: new Date().toISOString(),
    });

    expect(result.schedule.id).toBe(10);
    expect(result.frequencyCheck.allowed).toBe(true);
    expect(prisma.content.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'scheduled' },
    });
  });

  it('should block scheduling if anti-spam frequency exceeded without force', async () => {
    const mockContent = {
      id: 1,
      title: 'Video Review',
      channel: 'instagram',
      status: 'draft',
      links: [],
    };
    prisma.content.findUnique.mockResolvedValue(mockContent);
    prisma.postingSchedule.count.mockResolvedValue(3); // IG limit is 3

    await expect(
      service.createSchedule({
        contentId: 1,
        scheduledFor: new Date().toISOString(),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow scheduling if force is true even when frequency limit reached', async () => {
    const mockContent = {
      id: 1,
      title: 'Video Review',
      channel: 'instagram',
      status: 'draft',
      links: [],
    };
    prisma.content.findUnique.mockResolvedValue(mockContent);
    prisma.postingSchedule.count.mockResolvedValue(3);
    prisma.postingSchedule.create.mockResolvedValue({
      id: 20,
      contentId: 1,
      channel: 'instagram',
      scheduledFor: new Date(),
      status: 'pending',
    });

    const result = await service.createSchedule({
      contentId: 1,
      scheduledFor: new Date().toISOString(),
      force: true,
    });

    expect(result.schedule.id).toBe(20);
  });

  it('markAsPosted should update schedule to posted and content to published', async () => {
    const mockSchedule = {
      id: 10,
      contentId: 5,
      status: 'pending',
    };
    prisma.postingSchedule.findUnique.mockResolvedValue(mockSchedule);
    prisma.postingSchedule.update.mockResolvedValue({ ...mockSchedule, status: 'posted' });
    prisma.content.update.mockResolvedValue({ id: 5, status: 'published' });

    const res = await service.markAsPosted(10, { externalUrl: 'https://tiktok.com/@creator/video/123' });
    expect(res.status).toBe('posted');
    expect(prisma.content.update).toHaveBeenCalled();
  });
});
