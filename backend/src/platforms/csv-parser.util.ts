import { CommissionStatus } from './affiliate-platform.interface.js';

export function parseCsvRows(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Detect delimiter (comma vs semicolon)
  const delimiter = lines[0].includes(';') ? ';' : ',';

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
  );

  const results: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawValues = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = rawValues[idx] ?? '';
    });
    results.push(row);
  }

  return results;
}

export function parseRupiahAmount(val: string | number | undefined | null): number {
  if (val === undefined || val === null || val === '') {
    return 0;
  }
  if (typeof val === 'number') {
    return Math.round(val);
  }

  // Remove currency markers, spaces
  let cleaned = val.replace(/^(rp|idr)\.?\s*/i, '').trim();

  // Handle format like "15.000,00" vs "15,000.00" vs "15000"
  if (cleaned.includes('.') && cleaned.includes(',')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      // Indonesian format: 15.000,00
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 15,000.00
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes('.')) {
    // If only dots, could be 15.000 (thousand) or 15.5 (decimal)
    const parts = cleaned.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
  }

  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? 0 : Math.round(num);
}

export function normalizeCommissionStatus(statusStr: string | undefined): CommissionStatus {
  if (!statusStr) {
    return 'pending';
  }
  const s = statusStr.toLowerCase().trim();

  if (
    s.includes('complete') ||
    s.includes('valid') ||
    s.includes('settle') ||
    s.includes('selesai') ||
    s.includes('sah') ||
    s.includes('sukses')
  ) {
    return 'valid';
  }

  if (
    s.includes('cancel') ||
    s.includes('batal') ||
    s.includes('fail') ||
    s.includes('gagal') ||
    s.includes('invalid') ||
    s.includes('refund')
  ) {
    return 'cancelled';
  }

  return 'pending';
}
