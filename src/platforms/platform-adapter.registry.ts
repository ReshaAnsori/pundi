import { Injectable, NotFoundException } from '@nestjs/common';
import { AffiliatePlatform } from './affiliate-platform.interface.js';

@Injectable()
export class PlatformAdapterRegistry {
  private readonly adapters = new Map<string, AffiliatePlatform>();

  register(adapter: AffiliatePlatform): void {
    this.adapters.set(adapter.platformCode.toLowerCase(), adapter);
  }

  getAdapter(platformCode: string): AffiliatePlatform {
    const adapter = this.adapters.get(platformCode.toLowerCase());
    if (!adapter) {
      throw new NotFoundException(
        `No adapter registered for platform '${platformCode}'. Available platforms: ${this.getAvailablePlatforms().join(', ')}`,
      );
    }
    return adapter;
  }

  hasAdapter(platformCode: string): boolean {
    return this.adapters.has(platformCode.toLowerCase());
  }

  getAvailablePlatforms(): string[] {
    return Array.from(this.adapters.keys());
  }
}
