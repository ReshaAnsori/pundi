import { describe, expect, it } from 'vitest';
import {
  normalizeCommissionStatus,
  parseCsvRows,
  parseRupiahAmount,
} from './csv-parser.util.js';

describe('csv-parser.util', () => {
  it('should parse comma-separated csv content', () => {
    const csv = `Order ID,Product ID,Commission,Status\nORD-1,PROD-1,"15,000",Completed\nORD-2,PROD-2,20000,Pending`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]['order_id']).toBe('ORD-1');
    expect(rows[0]['commission']).toBe('15,000');
    expect(rows[1]['status']).toBe('Pending');
  });

  it('should parse semicolon-separated csv content', () => {
    const csv = `Order ID;Product ID;Commission\nORD-1;PROD-1;15.000\nORD-2;PROD-2;20.000`;
    const rows = parseCsvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]['order_id']).toBe('ORD-1');
  });

  it('should parse Indonesian rupiah formats into integer', () => {
    expect(parseRupiahAmount('Rp 15.000')).toBe(15000);
    expect(parseRupiahAmount('IDR 25.500,00')).toBe(25500);
    expect(parseRupiahAmount('1.250.000')).toBe(1250000);
    expect(parseRupiahAmount('50000')).toBe(50000);
    expect(parseRupiahAmount(75000)).toBe(75000);
    expect(parseRupiahAmount(null)).toBe(0);
  });

  it('should normalize commission statuses', () => {
    expect(normalizeCommissionStatus('Completed')).toBe('valid');
    expect(normalizeCommissionStatus('Sah')).toBe('valid');
    expect(normalizeCommissionStatus('Settled')).toBe('valid');
    expect(normalizeCommissionStatus('Cancelled')).toBe('cancelled');
    expect(normalizeCommissionStatus('Dibatalkan')).toBe('cancelled');
    expect(normalizeCommissionStatus('Pending')).toBe('pending');
    expect(normalizeCommissionStatus('Menunggu')).toBe('pending');
    expect(normalizeCommissionStatus('')).toBe('pending');
  });
});
