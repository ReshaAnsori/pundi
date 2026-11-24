import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service.js';
import { QueryDashboardDto } from './dto/query-dashboard.dto.js';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getSummary(query);
  }

  @Get('top-contents')
  getTopContents(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getTopContents(query);
  }

  @Get('top-products')
  getTopProducts(@Query() query: QueryDashboardDto) {
    return this.dashboardService.getTopProducts(query);
  }

  @Get('recent-activity')
  getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
