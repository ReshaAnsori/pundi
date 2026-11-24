import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AffiliatePlatform,
  RawCommissionRecord,
} from '../affiliate-platform.interface.js';
import {
  normalizeCommissionStatus,
  parseCsvRows,
  parseRupiahAmount,
} from '../csv-parser.util.js';

@Injectable()
export class ShopeeAdapter implements AffiliatePlatform {
  readonly platformCode = 'shopee';
  private readonly logger = new Logger(ShopeeAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  buildLink(productUrl: string, subId: string): string {
    try {
      const parsed = new URL(productUrl);
      parsed.searchParams.set('sub_id', subId);
      return parsed.toString();
    } catch {
      const separator = productUrl.includes('?') ? '&' : '?';
      return `${productUrl}${separator}sub_id=${encodeURIComponent(subId)}`;
    }
  }

  async fetchCommissions(since?: Date): Promise<RawCommissionRecord[]> {
    const appId = this.configService.get<string>('SHOPEE_APP_ID');
    const secret = this.configService.get<string>('SHOPEE_SECRET');

    if (!appId || !secret) {
      this.logger.debug(
        'SHOPEE_APP_ID or SHOPEE_SECRET not configured. Using CSV import fallback.',
      );
      return [];
    }

    // Shopee Affiliate GraphQL / Open API integration placeholder
    this.logger.log(`Fetching Shopee commissions since ${since?.toISOString()}`);
    return [];
  }

  parseCommissionCsv(csvContent: string): RawCommissionRecord[] {
    const rows = parseCsvRows(csvContent);
    const records: RawCommissionRecord[] = [];

    for (const row of rows) {
      // Find order external ID
      const orderId =
        row['order_id'] ||
        row['order_sn'] ||
        row['no__pesanan'] ||
        row['nomor_pesanan'] ||
        row['order_number'];

      if (!orderId) {
        continue;
      }

      const productId =
        row['item_id'] ||
        row['product_id'] ||
        row['id_produk'] ||
        row['sku_id'] ||
        null;

      const subId =
        row['sub_id'] ||
        row['sub_id_1'] ||
        row['sub_id_2'] ||
        row['sub_id1'] ||
        row['subid'] ||
        null;

      const commissionRaw =
        row['commission'] ||
        row['commission_amount'] ||
        row['estimasi_komisi'] ||
        row['komisi'] ||
        row['actual_commission'];

      const orderAmountRaw =
        row['order_amount'] ||
        row['total_pembayaran'] ||
        row['nilai_pesanan'] ||
        row['gmv'];

      const statusRaw =
        row['status'] ||
        row['order_status'] ||
        row['status_pesanan'] ||
        row['komisi_status'];

      const timeRaw =
        row['purchase_time'] ||
        row['order_time'] ||
        row['waktu_pesanan'] ||
        row['created_at'];

      const settledTimeRaw =
        row['complete_time'] ||
        row['settle_time'] ||
        row['waktu_selesai'];

      const orderedAt = timeRaw ? new Date(timeRaw) : new Date();
      const settledAt = settledTimeRaw ? new Date(settledTimeRaw) : null;

      records.push({
        orderExternalId: orderId,
        productExternalId: productId,
        subId: subId && subId.trim().length > 0 ? subId.trim() : null,
        amount: parseRupiahAmount(commissionRaw),
        orderAmount: orderAmountRaw ? parseRupiahAmount(orderAmountRaw) : null,
        status: normalizeCommissionStatus(statusRaw),
        orderedAt: Number.isNaN(orderedAt.getTime()) ? new Date() : orderedAt,
        settledAt:
          settledAt && !Number.isNaN(settledAt.getTime()) ? settledAt : null,
        raw: row,
      });
    }

    return records;
  }
}
