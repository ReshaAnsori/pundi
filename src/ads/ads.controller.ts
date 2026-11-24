import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { AdsService } from './ads.service.js';
import {
  CreateCampaignDto,
  RecordSpendDto,
  UpsertBudgetRuleDto,
} from './dto/campaign.dto.js';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Post('campaigns')
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.adsService.createCampaign(dto);
  }

  @Get('campaigns')
  listCampaigns(
    @Query('platform') platform?: string,
    @Query('status') status?: string,
  ) {
    return this.adsService.listCampaigns(platform, status);
  }

  @Get('summary')
  getSummary() {
    return this.adsService.getSummary();
  }

  @Get('budget-rules')
  getBudgetRules() {
    return this.adsService.getBudgetRules();
  }

  @Put('budget-rules')
  upsertBudgetRule(@Body() dto: UpsertBudgetRuleDto) {
    return this.adsService.upsertBudgetRule(dto);
  }

  @Post('guard/run-check')
  runBudgetGuardCheck() {
    return this.adsService.runBudgetGuardCheck();
  }

  @Get('campaigns/:id')
  getCampaignById(@Param('id', ParseIntPipe) id: number) {
    return this.adsService.getCampaignById(id);
  }

  @Post('campaigns/:id/record-spend')
  recordSpend(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordSpendDto,
  ) {
    return this.adsService.recordSpend(id, dto);
  }

  @Patch('campaigns/:id/pause')
  pauseCampaign(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.adsService.pauseCampaign(id, reason);
  }

  @Patch('campaigns/:id/resume')
  resumeCampaign(@Param('id', ParseIntPipe) id: number) {
    return this.adsService.resumeCampaign(id);
  }
}
