import { Module } from '@nestjs/common';
import { AssistantService } from './assistant.service.js';
import { AssistantController } from './assistant.controller.js';
import { LinksModule } from '../links/links.module.js';

@Module({
  imports: [LinksModule],
  controllers: [AssistantController],
  providers: [AssistantService],
  exports: [AssistantService],
})
export class AssistantModule {}
