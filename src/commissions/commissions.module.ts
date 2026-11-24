import { Module } from '@nestjs/common';
import { CommissionsService } from './commissions.service.js';
import { CommissionsController } from './commissions.controller.js';

@Module({
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
