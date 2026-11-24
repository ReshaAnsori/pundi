import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { MarkPostedDto, QueryScheduleDto } from './dto/query-schedule.dto.js';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('schedules')
  createSchedule(@Body() dto: CreateScheduleDto) {
    return this.schedulerService.createSchedule(dto);
  }

  @Get('schedules')
  listSchedules(@Query() query: QueryScheduleDto) {
    return this.schedulerService.listSchedules(query);
  }

  @Get('reminders')
  getDueReminders() {
    return this.schedulerService.getDueReminders();
  }

  @Get('frequency')
  getFrequency(@Query('date') date?: string) {
    return this.schedulerService.getChannelFrequencySummary(date);
  }

  @Get('schedules/:id')
  getScheduleById(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.getScheduleById(id);
  }

  @Patch('schedules/:id/posted')
  markAsPosted(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: MarkPostedDto,
  ) {
    return this.schedulerService.markAsPosted(id, dto);
  }

  @Patch('schedules/:id/skipped')
  markAsSkipped(
    @Param('id', ParseIntPipe) id: number,
    @Body('notes') notes?: string,
  ) {
    return this.schedulerService.markAsSkipped(id, notes);
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.schedulerService.deleteSchedule(id);
  }
}
