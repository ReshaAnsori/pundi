import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { ImportCsvDto } from './dto/import-csv.dto.js';
import { QuerySyncRunsDto } from './dto/query-sync-runs.dto.js';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post(':platform')
  sync(@Param('platform') platform: string) {
    return this.syncService.syncPlatform(platform);
  }

  @Post(':platform/csv')
  importCsv(
    @Param('platform') platform: string,
    @Body() dto: ImportCsvDto,
  ) {
    return this.syncService.importCsv(platform, dto.csv);
  }

  @Get('runs')
  getRuns(@Query() query: QuerySyncRunsDto) {
    return this.syncService.getRuns(query);
  }
}
