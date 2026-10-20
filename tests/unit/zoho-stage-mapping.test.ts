import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STAGE_BY_ZOHO_STATUS } from '../../migration/src/map-applications.mjs';
import { APPLICATION_STAGES } from '../../app/src/lib/database.types';

const STATUS_FILE = fileURLToPath(
  new URL('../support/fixtures/zoho-application-statuses.txt', import.meta.url),
);

describe('every Zoho application status lands on a real FOOS stage', () => {
  it('maps only onto stages that exist in APPLICATION_STAGES', () => {
    const stages = new Set<string>(APPLICATION_STAGES);
    const bad = [...STAGE_BY_ZOHO_STATUS.entries()].filter(([, v]) => !stages.has(v));
    expect(
      bad,
      'a mapping points at a stage the enum does not have, so the insert would fail',
    ).toEqual([]);
  });

  it('keys are lowercased, because lookup lowercases the incoming status', () => {
    const notLower = [...STAGE_BY_ZOHO_STATUS.keys()].filter((k) => k !== k.toLowerCase());
    expect(notLower, 'an uppercase key can never be hit').toEqual([]);
  });

  it('covers talent_pool, outreach and associated, the three added for this data', () => {
    const targets = new Set(STAGE_BY_ZOHO_STATUS.values());
    expect(targets.has('talent_pool')).toBe(true);
    expect(targets.has('outreach')).toBe(true);
    expect(targets.has('associated')).toBe(true);
  });

  it('covers every status present in the extracted data, so nothing defaults silently', () => {
      const statuses = readFileSync(STATUS_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      expect(statuses.length).toBeGreaterThan(0);
      const unmapped = statuses.filter((s) => !STAGE_BY_ZOHO_STATUS.has(s.toLowerCase()));
    expect(
      unmapped,
      'these statuses would default to talent_pool without anyone deciding that',
    ).toEqual([]);
  });
});
