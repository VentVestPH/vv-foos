import { describe, expect, it, vi } from 'vitest';
import {
  EMPTY_CELL,
  formatDate,
  formatDateTime,
  formatMoney,
} from '../../app/src/lib/format';
import { fmtMoney as dashFmtMoney } from '../../app/src/modules/dashboards/lib';
import { fmtDate as salesFmtDate, fmtMoney as salesFmtMoney } from '../../app/src/modules/sales/lib';

describe('formatMoney', () => {
  it('does not throw on an invalid currency code, which is the bug it was written for', () => {
    for (const bad of ['XX', 'DOLLARS', '12', 'US$', '']) {
      expect(() => formatMoney(1000, bad)).not.toThrow();
    }
    expect(formatMoney(1000, 'DOLLARS')).toBe('DOLLARS 1,000');
  });

  it('the dashboards wrapper no longer throws either, which was the live crash path', () => {
    expect(() => dashFmtMoney(1000, 'NOTACODE')).not.toThrow();
    expect(() => dashFmtMoney(1000, '')).not.toThrow();
  });

  it('formats a valid code as currency and accepts lower case', () => {
    expect(formatMoney(1000, 'USD')).toContain('1,000');
    expect(formatMoney(1000, 'usd')).toBe(formatMoney(1000, 'USD'));
  });

  it('returns the fallback for a null amount, not a zero', () => {
    expect(formatMoney(null, 'USD')).toBe(EMPTY_CELL);
    expect(formatMoney(undefined, 'USD')).toBe(EMPTY_CELL);
    expect(formatMoney(0, 'USD')).not.toBe(EMPTY_CELL);
  });

  it('keeps the sales behaviour it replaced', () => {
    expect(salesFmtMoney(null, 'USD')).toBe(EMPTY_CELL);
    expect(salesFmtMoney(2500, 'AUD')).toContain('2,500');
  });
});

describe('the recruit fallback the requisition grid depends on', () => {
  it('returns an empty string, so the info-grid filter still removes empty fields', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:55321');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
    const { fmtDate, fmtDateTime } = await import('../../app/src/modules/recruit/lib');
    expect(fmtDate(null), "RequisitionRecordPage filters on v !== ''").toBe('');
    expect(fmtDateTime(null)).toBe('');
    expect(fmtDate('2026-09-02')).not.toBe('');
    vi.unstubAllEnvs();
  });
});

describe('formatDate', () => {
  it('defaults to the empty-cell marker but honours an explicit fallback', () => {
    expect(formatDate(null)).toBe(EMPTY_CELL);
    expect(formatDate(null, '')).toBe('');
    expect(formatDate(undefined, '')).toBe('');
  });

  it('returns the input unchanged when it is not a parseable date, rather than Invalid Date', () => {
    expect(formatDate('not a date')).toBe('not a date');
    expect(formatDateTime('nonsense')).toBe('nonsense');
  });

  it('formats a real date and a real timestamp differently', () => {
    const date = formatDate('2026-09-02T14:31:00Z');
    const stamp = formatDateTime('2026-09-02T14:31:00Z');
    expect(date).toMatch(/2026/);
    expect(stamp).toMatch(/2026/);
    expect(stamp.length).toBeGreaterThan(date.length);
  });

  it('sales keeps the empty-cell fallback', () => {
    expect(salesFmtDate(null)).toBe(EMPTY_CELL);
  });
});
