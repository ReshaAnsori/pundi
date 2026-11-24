import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { LinksService } from './links.service.js';
import { CreateLinkDto } from './dto/create-link.dto.js';
import { QueryLinkDto } from './dto/query-link.dto.js';

@Controller('links')
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  create(@Body() dto: CreateLinkDto) {
    return this.linksService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryLinkDto) {
    return this.linksService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.linksService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.linksService.remove(id);
  }
}
