import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlatformAdapterRegistry } from '../platforms/platform-adapter.registry.js';
import { RawCommissionRecord } from '../platforms/affiliate-platform.interface.js';
import { QuerySyncRunsDto } from './dto/query-sync-runs.dto.js';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PlatformAdapterRegistry,
  ) {}

  async syncPlatform(platformCode: string, since?: Date) {
    const platform = await this.prisma.platform.findUnique({
      where: { code: platformCode.toLowerCase() },
    });
    if (!platform) {
      throw new NotFoundException(
        `Platform with code '${platformCode}' not found in database`,
      );
    }

    const adapter = this.registry.getAdapter(platform.code);

    const syncRun = await this.prisma.syncRun.create({
      data: {
        platformId: platform.id,
        status: 'running',
        startedAt: new Date(),
        recordsUpserted: 0,
      },
    });

    try {
      const records = await adapter.fetchCommissions(since);
      const recordsUpserted = await this.saveCommissionRecords(
        platform.id,
        records,
      );

      const finished = await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'ok',
          finishedAt: new Date(),
          recordsUpserted,
        },
      });

      return {
        status: 'ok',
        syncRunId: finished.id,
        recordsUpserted,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown sync error';
      this.logger.error(
        `Sync failed for platform ${platform.code}: ${errorMessage}`,
      );

      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: errorMessage,
        },
      });

      throw err;
    }
  }

  async importCsv(platformCode: string, csvContent: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { code: platformCode.toLowerCase() },
    });
    if (!platform) {
      throw new NotFoundException(
        `Platform with code '${platformCode}' not found in database`,
      );
    }

    const adapter = this.registry.getAdapter(platform.code);
    if (!adapter.parseCommissionCsv) {
      throw new BadRequestException(
        `Platform adapter for '${platformCode}' does not support CSV parsing`,
      );
    }

    const syncRun = await this.prisma.syncRun.create({
      data: {
        platformId: platform.id,
        status: 'running',
        startedAt: new Date(),
        recordsUpserted: 0,
      },
    });

    try {
      const records = await adapter.parseCommissionCsv(csvContent);
      const recordsUpserted = await this.saveCommissionRecords(
        platform.id,
        records,
      );

      const finished = await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'ok',
          finishedAt: new Date(),
          recordsUpserted,
        },
      });

      return {
        status: 'ok',
        syncRunId: finished.id,
        recordsUpserted,
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'CSV import error';
      this.logger.error(
        `CSV import failed for platform ${platform.code}: ${errorMessage}`,
      );

      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: errorMessage,
        },
      });

      throw err;
    }
  }

  async saveCommissionRecords(
    platformId: number,
    records: RawCommissionRecord[],
  ): Promise<number> {
    let count = 0;

    for (const record of records) {
      let linkId: number | null = null;

      // Link mapping via subId
      if (record.subId) {
        const link = await this.prisma.affiliateLink.findUnique({
          where: { subId: record.subId },
        });
        if (link) {
          linkId = link.id;
        }
      }

      const productExternalId = record.productExternalId ?? '';

      await this.prisma.commission.upsert({
        where: {
          platformId_orderExternalId_productExternalId: {
            platformId,
            orderExternalId: record.orderExternalId,
            productExternalId,
          },
        },
        create: {
          platformId,
          linkId,
          orderExternalId: record.orderExternalId,
          productExternalId,
          status: record.status,
          amount: record.amount,
          orderAmount: record.orderAmount ?? null,
          orderedAt: record.orderedAt,
          settledAt: record.settledAt ?? null,
          raw: record.raw ? JSON.stringify(record.raw) : null,
        },
        update: {
          linkId: linkId !== null ? linkId : undefined,
          status: record.status,
          amount: record.amount,
          orderAmount: record.orderAmount ?? undefined,
          settledAt: record.settledAt ?? undefined,
          raw: record.raw ? JSON.stringify(record.raw) : undefined,
        },
      });

      count++;
    }

    return count;
  }

  async getRuns(query?: QuerySyncRunsDto) {
    const where: Record<string, unknown> = {};
    if (query?.platformId) {
      where.platformId = query.platformId;
    }

    return this.prisma.syncRun.findMany({
      where,
      include: {
        platform: true,
      },
      orderBy: { id: 'desc' },
      take: query?.limit ?? 50,
    });
  }
}
