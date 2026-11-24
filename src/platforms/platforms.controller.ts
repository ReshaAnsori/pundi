import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { PlatformsService } from './platforms.service.js';
import { CreatePlatformDto } from './dto/create-platform.dto.js';
import { UpdatePlatformDto } from './dto/update-platform.dto.js';

@Controller('platforms')
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Post()
  create(@Body() dto: CreatePlatformDto) {
    return this.platformsService.create(dto);
  }

  @Get()
  findAll() {
    return this.platformsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.platformsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlatformDto,
  ) {
    return this.platformsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.platformsService.remove(id);
  }
}
