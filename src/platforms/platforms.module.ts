import { Module, OnModuleInit } from '@nestjs/common';
import { PlatformsService } from './platforms.service.js';
import { PlatformsController } from './platforms.controller.js';
import { PlatformAdapterRegistry } from './platform-adapter.registry.js';
import { ShopeeAdapter } from './adapters/shopee.adapter.js';
import { TikTokAdapter } from './adapters/tiktok.adapter.js';

@Module({
  controllers: [PlatformsController],
  providers: [
    PlatformsService,
    PlatformAdapterRegistry,
    ShopeeAdapter,
    TikTokAdapter,
  ],
  exports: [
    PlatformsService,
    PlatformAdapterRegistry,
    ShopeeAdapter,
    TikTokAdapter,
  ],
})
export class PlatformsModule implements OnModuleInit {
  constructor(
    private readonly registry: PlatformAdapterRegistry,
    private readonly shopeeAdapter: ShopeeAdapter,
    private readonly tikTokAdapter: TikTokAdapter,
  ) {}

  onModuleInit() {
    this.registry.register(this.shopeeAdapter);
    this.registry.register(this.tikTokAdapter);
  }
}
