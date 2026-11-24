import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { AssistantService } from './assistant.service.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('generate')
  generate(@Body() dto: GenerateContentDto) {
    return this.assistantService.generate(dto);
  }

  @Post('generate-and-save')
  generateAndSave(@Body() dto: GenerateContentDto) {
    return this.assistantService.generateAndSaveDraft(dto);
  }

  @Patch('contents/:contentId/publish')
  publish(@Param('contentId', ParseIntPipe) contentId: number) {
    return this.assistantService.reviewAndPublish(contentId);
  }
}
