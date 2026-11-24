import { describe, expect, it } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PlatformAdapterRegistry } from './platform-adapter.registry.js';
import { AffiliatePlatform } from './affiliate-platform.interface.js';

describe('PlatformAdapterRegistry', () => {
  it('should register and retrieve adapters case-insensitively', () => {
    const registry = new PlatformAdapterRegistry();
    const mockShopee: AffiliatePlatform = {
      platformCode: 'shopee',
      buildLink: (url, subId) => `${url}?sub_id=${subId}`,
      fetchCommissions: vi.fn(),
    };

    registry.register(mockShopee);
    expect(registry.hasAdapter('Shopee')).toBe(true);
    expect(registry.getAdapter('SHOPEE')).toBe(mockShopee);
    expect(registry.getAvailablePlatforms()).toEqual(['shopee']);
  });

  it('should throw NotFoundException if adapter not found', () => {
    const registry = new PlatformAdapterRegistry();
    expect(() => registry.getAdapter('tokopedia')).toThrow(NotFoundException);
  });
});
