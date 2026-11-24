import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { MarkPostedDto, QueryScheduleDto } from './dto/query-schedule.dto.js';
import {
  checkPostingFrequency,
  DEFAULT_CHANNEL_LIMITS,
} from './anti-spam-guard.util.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSchedule(dto: CreateScheduleDto) {
    const content = await this.prisma.content.findUnique({
      where: { id: dto.contentId },
      include: {
        links: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`Content with ID ${dto.contentId} not found`);
    }

    const channel = dto.channel || content.channel;
    const scheduledDate = new Date(dto.scheduledFor);

    if (isNaN(scheduledDate.getTime())) {
      throw new BadRequestException('Invalid date format for scheduledFor');
    }

    // Check anti-spam frequency limits for this channel on that target date
    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scheduledDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCount = await this.prisma.postingSchedule.count({
      where: {
        channel: channel.toLowerCase(),
        scheduledFor: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'skipped',
        },
      },
    });

    const frequencyCheck = checkPostingFrequency(channel, existingCount);
    if (!frequencyCheck.allowed && !dto.force) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'SpamPatternPrevention',
        message: frequencyCheck.message,
        frequencyCheck,
      });
    }

    const schedule = await this.prisma.postingSchedule.create({
      data: {
        contentId: content.id,
        channel: channel.toLowerCase(),
        scheduledFor: scheduledDate,
        status: 'pending',
        notes: dto.notes,
      },
      include: {
        content: {
          include: {
            links: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });

    // Update content status to "scheduled" if it was "draft"
    if (content.status === 'draft') {
      await this.prisma.content.update({
        where: { id: content.id },
        data: { status: 'scheduled' },
      });
    }

    return {
      schedule,
      frequencyCheck,
    };
  }

  async listSchedules(query: QueryScheduleDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.channel) {
      where.channel = query.channel.toLowerCase();
    }
    if (query.from || query.to) {
      where.scheduledFor = {};
      if (query.from) {
        where.scheduledFor.gte = new Date(query.from);
      }
      if (query.to) {
        where.scheduledFor.lte = new Date(query.to);
      }
    }

    return this.prisma.postingSchedule.findMany({
      where,
      orderBy: { scheduledFor: 'asc' },
      include: {
        content: {
          include: {
            links: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  async getScheduleById(id: number) {
    const schedule = await this.prisma.postingSchedule.findUnique({
      where: { id },
      include: {
        content: {
          include: {
            links: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }
    return schedule;
  }

  async getDueReminders() {
    const now = new Date();
    return this.prisma.postingSchedule.findMany({
      where: {
        scheduledFor: {
          lte: now,
        },
        status: {
          in: ['pending', 'ready_to_post'],
        },
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        content: {
          include: {
            links: {
              include: {
                product: true,
              },
            },
          },
        },
      },
    });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronReminders() {
    const now = new Date();
    const dueSchedules = await this.prisma.postingSchedule.findMany({
      where: {
        scheduledFor: {
          lte: now,
        },
        status: 'pending',
      },
      include: { content: true },
    });

    if (dueSchedules.length > 0) {
      this.logger.log(`Found ${dueSchedules.length} due content schedule(s) for manual upload`);
      for (const item of dueSchedules) {
        await this.prisma.postingSchedule.update({
          where: { id: item.id },
          data: {
            status: 'ready_to_post',
            reminderSent: true,
          },
        });
        this.logger.log(`Reminder: Content "${item.content.title}" is ready to post on ${item.channel}`);
      }
    }
  }

  async markAsPosted(id: number, dto?: MarkPostedDto) {
    const schedule = await this.getScheduleById(id);

    const updatedSchedule = await this.prisma.postingSchedule.update({
      where: { id },
      data: {
        status: 'posted',
      },
      include: {
        content: true,
      },
    });

    // Mark content as published
    await this.prisma.content.update({
      where: { id: schedule.contentId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        ...(dto?.externalUrl ? { externalUrl: dto.externalUrl } : {}),
      },
    });

    return updatedSchedule;
  }

  async markAsSkipped(id: number, notes?: string) {
    await this.getScheduleById(id);

    return this.prisma.postingSchedule.update({
      where: { id },
      data: {
        status: 'skipped',
        ...(notes ? { notes } : {}),
      },
      include: {
        content: true,
      },
    });
  }

  async deleteSchedule(id: number) {
    const schedule = await this.getScheduleById(id);

    await this.prisma.postingSchedule.delete({
      where: { id },
    });

    // Check if content has any remaining active schedules
    const remaining = await this.prisma.postingSchedule.count({
      where: {
        contentId: schedule.contentId,
        status: { in: ['pending', 'ready_to_post'] },
      },
    });

    if (remaining === 0) {
      const content = await this.prisma.content.findUnique({
        where: { id: schedule.contentId },
      });
      if (content && content.status === 'scheduled') {
        await this.prisma.content.update({
          where: { id: content.id },
          data: { status: 'draft' },
        });
      }
    }

    return { message: 'Schedule deleted successfully' };
  }

  async getChannelFrequencySummary(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const counts = await this.prisma.postingSchedule.groupBy({
      by: ['channel'],
      where: {
        scheduledFor: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: {
          not: 'skipped',
        },
      },
      _count: {
        id: true,
      },
    });

    const countMap: Record<string, number> = {};
    for (const c of counts) {
      countMap[c.channel] = c._count.id;
    }

    const summary = Object.entries(DEFAULT_CHANNEL_LIMITS).map(
      ([channel, maxLimit]) => {
        const currentCount = countMap[channel] || 0;
        return {
          channel,
          currentCount,
          maxLimit,
          remaining: Math.max(0, maxLimit - currentCount),
          status:
            currentCount >= maxLimit
              ? 'limit_reached'
              : currentCount >= maxLimit - 1
                ? 'warning'
                : 'safe',
        };
      },
    );

    return {
      date: startOfDay.toISOString().split('T')[0],
      channels: summary,
    };
  }
}
