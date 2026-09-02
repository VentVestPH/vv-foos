import { describe, expect, it } from 'vitest';
import {
  parsePartialDate,
  parseStarGrade,
  parseZohoBoolean,
  parseZohoNumber,
  parseZohoTimestamp,
} from '../../migration/src/zoho.mjs';
import { STATUS_ALIASES, resolveStatus } from '../../migration/src/lookups.mjs';

const CREATED = '06/20/2026 10:00 AM';

describe('parseZohoTimestamp', () => {
  it('reads the Recruit export shape, MM/DD/YYYY hh:mm AM/PM', () => {
    expect(parseZohoTimestamp('09/02/2026 02:31 PM')).toBe('2026-09-02T14:31:00Z');
    expect(parseZohoTimestamp('09/02/2026 12:00 AM')).toBe('2026-09-02T00:00:00Z');
    expect(parseZohoTimestamp('09/02/2026 12:00 PM')).toBe('2026-09-02T12:00:00Z');
  });

  it('reads the CRM export shape, YYYY-MM-DD HH:MM:SS', () => {
    expect(parseZohoTimestamp('2026-09-02 14:31:07')).toBe('2026-09-02T14:31:07Z');
    expect(parseZohoTimestamp('2026-09-02T14:31:07Z')).toBe('2026-09-02T14:31:07Z');
    expect(parseZohoTimestamp('2026-09-02 14:31')).toBe('2026-09-02T14:31:00Z');
  });

  it('keeps an explicit offset rather than assuming UTC', () => {
    expect(parseZohoTimestamp('2026-09-02T14:31:07+08:00')).toBe('2026-09-02T14:31:07+08:00');
  });

  it('rejects impossible dates and times instead of rolling them over', () => {
    expect(parseZohoTimestamp('2026-02-30 10:00:00')).toBeNull();
    expect(parseZohoTimestamp('2026-13-01 10:00:00')).toBeNull();
    expect(parseZohoTimestamp('2026-09-02 25:00:00')).toBeNull();
    expect(parseZohoTimestamp('13/01/2026 01:00 PM')).toBeNull();
    expect(parseZohoTimestamp('not a date')).toBeNull();
    expect(parseZohoTimestamp('')).toBeNull();
  });
});

describe('parsePartialDate', () => {
  it('takes the year from the row own Created Time, never from today', () => {
    expect(parsePartialDate('1/15', CREATED)).toBe('2026-01-15');
    expect(parsePartialDate('1/15', '06/20/2024 10:00 AM')).toBe('2024-01-15');
  });

  it('reads the DD-Mon shape that the first import dropped', () => {
    expect(parsePartialDate('12-Jun', CREATED)).toBe('2026-06-12');
    expect(parsePartialDate('05-May', CREATED)).toBe('2026-05-05');
    expect(parsePartialDate('12 Jun', CREATED)).toBe('2026-06-12');
    expect(parsePartialDate('Sept-3', CREATED)).toBe('2026-09-03');
    expect(parsePartialDate('Jun-12', CREATED)).toBe('2026-06-12');
  });

  it('refuses a day that does not exist in that month', () => {
    expect(parsePartialDate('31-Feb', CREATED)).toBeNull();
    expect(parsePartialDate('2/30', CREATED)).toBeNull();
  });

  it('returns null when there is no year to borrow', () => {
    expect(parsePartialDate('12-Jun', '')).toBeNull();
    expect(parsePartialDate('12-Jun', 'nonsense')).toBeNull();
  });
});

describe('parseStarGrade', () => {
  it('accepts the 2.0 style the export uses for an integer grade', () => {
    expect(parseStarGrade('2.0')).toEqual({ grade: 2, reason: null });
    expect(parseStarGrade('3')).toEqual({ grade: 3, reason: null });
  });

  it('reports out of range rather than clamping into the CHECK', () => {
    expect(parseStarGrade('4.0').grade).toBeNull();
    expect(parseStarGrade('0').grade).toBeNull();
    expect(parseStarGrade('2.5').grade).toBeNull();
  });

  it('separates empty from unparseable so the report can tell them apart', () => {
    expect(parseStarGrade('').reason).toBe('empty');
    expect(parseStarGrade('good').reason).toBe('unparseable');
  });
});

describe('parseZohoBoolean and parseZohoNumber', () => {
  it('only accepts the two literals Zoho emits', () => {
    expect(parseZohoBoolean('true')).toBe(true);
    expect(parseZohoBoolean('false')).toBe(false);
    expect(parseZohoBoolean('yes')).toBeNull();
    expect(parseZohoBoolean('')).toBeNull();
  });

  it('strips the thousands separators the salary columns carry', () => {
    expect(parseZohoNumber('1,200')).toBe(1200);
    expect(parseZohoNumber('1 200.50')).toBe(1200.5);
    expect(parseZohoNumber('n/a')).toBeNull();
  });
});

describe('status aliasing', () => {
  it('maps the Zoho Hired label onto the FOOS Placed status', () => {
    expect(STATUS_ALIASES.get('Hired')).toBe('Placed');
  });

  it('resolves through the alias and records genuinely unknown labels', () => {
    const lookups = {
      staffByName: new Map(),
      sourceByName: new Map(),
      statusByLabel: new Map([['placed', 'status-uuid']]),
    };
    const unresolved = { staff: new Map(), source: new Map(), status: new Map() };
    expect(resolveStatus(lookups, 'Hired', unresolved)).toBe('status-uuid');
    expect(unresolved.status.size).toBe(0);
    expect(resolveStatus(lookups, 'Invented Label', unresolved)).toBeNull();
    expect(unresolved.status.get('Invented Label')).toBe(1);
  });
});
