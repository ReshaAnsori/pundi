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
export class TikTokAdapter implements AffiliatePlatform {
  readonly platformCode = 'tiktok';
  private readonly logger = new Logger(TikTokAdapter.name);

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
    const appKey = this.configService.get<string>('TIKTOK_APP_KEY');
    const secret = this.configService.get<string>('TIKTOK_SECRET');

    if (!appKey || !secret) {
      this.logger.debug(
        'TIKTOK_APP_KEY or TIKTOK_SECRET not configured. Using CSV import fallback.',
      );
      return [];
    }

    this.logger.log(`Fetching TikTok commissions since ${since?.toISOString()}`);
    return [];
  }

  parseCommissionCsv(csvContent: string): RawCommissionRecord[] {
    const rows = parseCsvRows(csvContent);
    const records: RawCommissionRecord[] = [];

    for (const row of rows) {
      const orderId =
        row['order_id'] ||
        row['order_no'] ||
        row['order_number'] ||
        row['id_pesanan'];

      if (!orderId) {
        continue;
      }

      const productId =
        row['product_id'] ||
        row['item_id'] ||
        row['id_produk'] ||
        null;

      const subId =
        row['sub_id'] ||
        row['subid'] ||
        row['tag'] ||
        row['parameter'] ||
        null;

      const commissionRaw =
        row['commission'] ||
        row['commission_amount'] ||
        row['estimated_commission'] ||
        row['komisi'];

      const orderAmountRaw =
        row['order_value'] ||
        row['gmv'] ||
        row['order_amount'] ||
        row['total_harga'];

      const statusRaw =
        row['status'] ||
        row['order_status'] ||
        row['settlement_status'];

      const timeRaw =
        row['creation_time'] ||
        row['order_time'] ||
        row['created_at'] ||
        row['waktu_pembuatan'];

      const settledTimeRaw =
        row['settlement_time'] ||
        row['settled_at'];

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
