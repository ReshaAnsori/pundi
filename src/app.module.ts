import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ApiKeyGuard } from './common/guards/api-key.guard.js';
import { HealthModule } from './health/health.module.js';
import { PlatformsModule } from './platforms/platforms.module.js';
import { ProductsModule } from './products/products.module.js';
import { ContentsModule } from './contents/contents.module.js';
import { LinksModule } from './links/links.module.js';
import { SyncModule } from './sync/sync.module.js';
import { CommissionsModule } from './commissions/commissions.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { UiModule } from './ui/ui.module.js';
import { ResearchModule } from './research/research.module.js';
import { AssistantModule } from './assistant/assistant.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ObserveModule.forRoot({
      appKey: process.env.OBSERVE_APP_KEY ?? 'YOUR_APP_KEY',
      appSecret: process.env.OBSERVE_APP_SECRET ?? 'YOUR_APP_SECRET',
      serviceId: 'backend',
    }),
    PrismaModule,
    HealthModule,
    PlatformsModule,
    ProductsModule,
    ContentsModule,
    LinksModule,
    SyncModule,
    CommissionsModule,
    DashboardModule,
    UiModule,
    ResearchModule,
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
