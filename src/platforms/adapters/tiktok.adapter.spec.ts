import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { TikTokAdapter } from './tiktok.adapter.js';

describe('TikTokAdapter', () => {
  let adapter: TikTokAdapter;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue(null),
    } as unknown as ConfigService;
    adapter = new TikTokAdapter(configService);
  });

  it('should build link with sub_id parameter', () => {
    const url = 'https://shop.tiktok.com/item/456';
    const built = adapter.buildLink(url, 'c5_p6_abc');
    expect(built).toContain('sub_id=c5_p6_abc');
  });

  it('should parse TikTok export CSV content', () => {
    const csv = `Order ID,Product ID,Sub ID,Commission,Order Value,Status,Creation Time
57891234,998877,c5_p6_abc,IDR 30.000,IDR 300.000,Settled,2026-11-24 12:00:00
57891235,998878,c5_p7_def,IDR 12.000,IDR 120.000,Cancelled,2026-11-24 13:00:00`;

    const records = adapter.parseCommissionCsv(csv);
    expect(records).toHaveLength(2);

    expect(records[0].orderExternalId).toBe('57891234');
    expect(records[0].productExternalId).toBe('998877');
    expect(records[0].subId).toBe('c5_p6_abc');
    expect(records[0].amount).toBe(30000);
    expect(records[0].status).toBe('valid');

    expect(records[1].orderExternalId).toBe('57891235');
    expect(records[1].status).toBe('cancelled');
    expect(records[1].amount).toBe(12000);
  });
});
