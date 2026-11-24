import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ResearchService } from './research.service.js';
import { QueryRecommendationsDto } from './dto/query-recommendations.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';

@Controller('research')
export class ResearchController {
  constructor(private readonly researchService: ResearchService) {}

  @Get('recommendations')
  getRecommendations(@Query() query: QueryRecommendationsDto) {
    return this.researchService.getRecommendations(query);
  }

  @Post('calculate-scores')
  calculateScores(@Query('platformId', new ParseIntPipe({ optional: true })) platformId?: number) {
    return this.researchService.calculateAndSaveScores(platformId);
  }

  @Patch('products/:productId/status')
  updateStatus(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() dto: UpdateProductStatusDto,
  ) {
    return this.researchService.updateProductStatus(productId, dto);
  }

  @Get('categories')
  getCategories() {
    return this.researchService.getCategories();
  }
}
