import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ShopeeAdapter } from './shopee.adapter.js';

describe('ShopeeAdapter', () => {
  let adapter: ShopeeAdapter;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: vi.fn().mockReturnValue(null),
    } as unknown as ConfigService;
    adapter = new ShopeeAdapter(configService);
  });

  it('should build link with sub_id parameter', () => {
    const url = 'https://shopee.co.id/product-123';
    const built = adapter.buildLink(url, 'c1_p2_xyz');
    expect(built).toContain('sub_id=c1_p2_xyz');
  });

  it('should parse Shopee export CSV content', () => {
    const csv = `No. Pesanan,ID Produk,Sub_id 1,Estimasi Komisi,Total Pembayaran,Status Pesanan,Waktu Pesanan
241124ABCD,123456,c1_p2_xyz,Rp 15.000,Rp 150.000,Selesai,2026-11-24 10:00:00
241124EFGH,789012,c1_p3_abc,Rp 25.000,Rp 200.000,Menunggu,2026-11-24 11:00:00`;

    const records = adapter.parseCommissionCsv(csv);
    expect(records).toHaveLength(2);

    expect(records[0].orderExternalId).toBe('241124ABCD');
    expect(records[0].productExternalId).toBe('123456');
    expect(records[0].subId).toBe('c1_p2_xyz');
    expect(records[0].amount).toBe(15000);
    expect(records[0].orderAmount).toBe(150000);
    expect(records[0].status).toBe('valid');

    expect(records[1].orderExternalId).toBe('241124EFGH');
    expect(records[1].status).toBe('pending');
    expect(records[1].amount).toBe(25000);
  });
});
