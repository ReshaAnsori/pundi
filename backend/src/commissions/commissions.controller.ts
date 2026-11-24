import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CommissionsService } from './commissions.service.js';
import { QueryCommissionsDto } from './dto/query-commissions.dto.js';

@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get('summary')
  getSummary() {
    return this.commissionsService.getSummary();
  }

  @Get()
  findAll(@Query() query: QueryCommissionsDto) {
    return this.commissionsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commissionsService.findOne(id);
  }
}
