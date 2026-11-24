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
import { ContentsService } from './contents.service.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { UpdateContentDto } from './dto/update-content.dto.js';
import { QueryContentDto } from './dto/query-content.dto.js';

@Controller('contents')
export class ContentsController {
  constructor(private readonly contentsService: ContentsService) {}

  @Post()
  create(@Body() dto: CreateContentDto) {
    return this.contentsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryContentDto) {
    return this.contentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentDto,
  ) {
    return this.contentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contentsService.remove(id);
  }

  @Get(':id/links')
  findLinks(@Param('id', ParseIntPipe) id: number) {
    return this.contentsService.findLinks(id);
  }
}
