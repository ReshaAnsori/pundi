export type CommissionStatus = 'pending' | 'valid' | 'cancelled';

export interface RawCommissionRecord {
  orderExternalId: string;
  productExternalId?: string | null;
  status: CommissionStatus;
  amount: number; // integer rupiah (e.g. 15000)
  orderAmount?: number | null; // integer rupiah
  orderedAt: Date;
  settledAt?: Date | null;
  subId?: string | null;
  raw?: Record<string, unknown> | string | null;
}

export interface PlatformProductRecord {
  externalId: string;
  name: string;
  price?: number | null;
  commissionRate?: number | null;
  url?: string | null;
  imageUrl?: string | null;
  category?: string | null;
}

export interface AffiliatePlatform {
  readonly platformCode: string;

  /**
   * Generates or attaches the tracking subId to a product URL.
   */
  buildLink(productUrl: string, subId: string): Promise<string> | string;

  /**
   * Fetches commission records from the official API since a given date.
   */
  fetchCommissions(since?: Date): Promise<RawCommissionRecord[]>;

  /**
   * Parses CSV files exported from the platform's affiliate dashboard.
   */
  parseCommissionCsv?(
    csvContent: string,
  ): Promise<RawCommissionRecord[]> | RawCommissionRecord[];

  /**
   * Optional: Fetches product records from platform feeds/API.
   */
  fetchProducts?(): Promise<PlatformProductRecord[]>;
}
