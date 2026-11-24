import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('roi/contents')
  getContentRoi(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.analyticsService.getContentRoi(limitNum);
  }

  @Get('roi/niches')
  getNicheRoi() {
    return this.analyticsService.getNicheRoi();
  }

  @Get('roi/platforms')
  getPlatformRoi() {
    return this.analyticsService.getPlatformRoi();
  }

  @Get('roi/hourly')
  getHourlyReturn() {
    return this.analyticsService.getHourlyReturnAnalysis();
  }

  @Get('weekly-report')
  getWeeklyReport(@Query('offset') offset?: string) {
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.analyticsService.getWeeklyReport(offsetNum);
  }
}
