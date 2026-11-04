import { describe, expect, it } from 'vitest';
import {
  buildCandidateRows,
  type CandidateListRow,
} from '../../app/src/modules/recruit/candidates/candidateRows';
import type { Application } from '../../app/src/modules/recruit/lib';

const row = {
  person_id: 'p1',
  first_name: 'Ada',
  middle_name: null,
  last_name: 'Lovelace',
  emails: [],
  city: null,
  state: null,
  country: null,
  person_updated_at: '2026-11-01T00:00:00Z',
  do_not_contact: false,
  has_resume: false,
} as unknown as CandidateListRow;

const app = (id: string, requisition: string): Application =>
  ({ id, person_id: 'p1', requisition_id: requisition }) as unknown as Application;

describe('buildCandidateRows requisitions', () => {
  it('lists requisition names, not job codes', () => {
    const [built] = buildCandidateRows({
      rows: [row],
      apps: [app('a1', 'r1'), app('a2', 'r2')],
      reqName: new Map([
        ['r1', 'Senior Backend Engineer'],
        ['r2', 'Product Designer'],
      ]),
    });
    expect(built?.requisition_names).toEqual(['Senior Backend Engineer', 'Product Designer']);
    expect(built?.requisitions).toBe('Senior Backend Engineer, Product Designer');
  });

  it('skips applications whose requisition is not loaded', () => {
    const [built] = buildCandidateRows({
      rows: [row],
      apps: [app('a1', 'r1'), app('a2', 'missing')],
      reqName: new Map([['r1', 'Product Designer']]),
    });
    expect(built?.requisition_names).toEqual(['Product Designer']);
  });

  it('is empty when the candidate has no applications', () => {
    const [built] = buildCandidateRows({ rows: [row], apps: [], reqName: new Map() });
    expect(built?.requisition_names).toEqual([]);
    expect(built?.requisitions).toBe('');
  });
});
