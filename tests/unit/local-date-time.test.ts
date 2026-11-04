import { describe, expect, it } from 'vitest';
import { joinLocal, splitLocal } from '../../app/src/lib/localDateTime';

describe('splitLocal', () => {
  it('returns empty parts for missing or invalid input', () => {
    expect(splitLocal(null)).toEqual({ date: '', time: '' });
    expect(splitLocal('')).toEqual({ date: '', time: '' });
    expect(splitLocal('not a date')).toEqual({ date: '', time: '' });
  });

  it('round-trips through joinLocal', () => {
    const iso = new Date(2026, 9, 30, 14, 5).toISOString();
    const parts = splitLocal(iso);
    expect(parts).toEqual({ date: '2026-10-30', time: '14:05' });
    expect(joinLocal(parts.date, parts.time)).toBe(iso);
  });
});

describe('joinLocal', () => {
  it('rejects malformed or impossible values', () => {
    expect(joinLocal('', '10:00')).toBeNull();
    expect(joinLocal('2026-10-30', '')).toBeNull();
    expect(joinLocal('2026-02-30', '10:00')).toBeNull();
    expect(joinLocal('2026-10-30', '25:00')).toBeNull();
    expect(joinLocal('30/10/2026', '10:00')).toBeNull();
  });

  it('builds a local timestamp', () => {
    expect(joinLocal('2026-10-30', '09:30')).toBe(new Date(2026, 9, 30, 9, 30).toISOString());
  });
});
