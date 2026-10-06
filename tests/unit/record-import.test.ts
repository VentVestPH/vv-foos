import { describe, expect, it } from 'vitest';
import { missingRequiredMappings, planAccounts, planRequisitions } from '../../app/src/modules/intake/recordImport';

const ACCOUNT_MAP = { name: 'Name', types: 'Type', email: 'Email', phone: 'Phone', website: 'Web' };
const REQ_MAP = {
  title: 'Title',
  account: 'Account',
  job_code: 'Code',
  status: 'Status',
  num_openings: 'Openings',
  pay_min: 'Min',
  pay_max: 'Max',
  pay_currency: 'Currency',
  opened_date: 'Opened',
};

describe('account import plan', () => {
  it('requires the name mapping', () => {
    expect(missingRequiredMappings('account', {})).toEqual(['Account name']);
    expect(missingRequiredMappings('account', { name: 'Name' })).toEqual([]);
  });

  it('builds inserts, defaults the type to prospect, and normalises the website', () => {
    const plan = planAccounts([{ Name: 'Acme', Web: 'acme.example' }], ACCOUNT_MAP, new Set());
    expect(plan.issues).toEqual([]);
    expect(plan.rows[0]!.insert).toMatchObject({ name: 'Acme', types: ['prospect'], website: 'https://acme.example/' });
  });

  it('skips accounts that already exist or repeat within the sheet, without raising an issue', () => {
    const plan = planAccounts([{ Name: 'Aster' }, { Name: 'New Co' }, { Name: 'new co' }], ACCOUNT_MAP, new Set(['aster']));
    expect(plan.issues).toEqual([]);
    expect(plan.rows.map((row) => row.skipReason)).toEqual([
      'An account with this name already exists',
      null,
      'Repeated earlier in this sheet',
    ]);
  });

  it('reports each invalid row by its sheet row number', () => {
    const plan = planAccounts(
      [{ Name: '' }, { Name: 'A', Type: 'vendor' }, { Name: 'B', Email: 'nope' }, { Name: 'C', Phone: 'CALL' }, { Name: 'D', Web: 'not a site' }],
      ACCOUNT_MAP,
      new Set(),
    );
    expect(plan.issues.map((issue) => issue.row)).toEqual([2, 3, 4, 5, 6]);
    expect(plan.issues[1]!.message).toMatch(/vendor/);
  });
});

describe('requisition import plan', () => {
  const companies = new Map([['aster analytics', 'company-1']]);

  it('requires title and account mappings', () => {
    expect(missingRequiredMappings('requisition', { title: 'Title' })).toEqual(['Account name']);
  });

  it('resolves the account by name, case-insensitively, and defaults to draft with one opening', () => {
    const plan = planRequisitions([{ Title: 'Engineer', Account: 'ASTER ANALYTICS' }], REQ_MAP, companies, new Set());
    expect(plan.issues).toEqual([]);
    expect(plan.rows[0]!.insert).toMatchObject({ title: 'Engineer', company_id: 'company-1', status: 'draft', num_openings: 1 });
  });

  it('accepts a human status label and numeric pay with thousands separators', () => {
    const plan = planRequisitions(
      [{ Title: 'Engineer', Account: 'Aster Analytics', Status: 'On Hold', Min: '120,000', Max: '150000', Currency: 'php', Opened: '2026-10-01' }],
      REQ_MAP,
      companies,
      new Set(),
    );
    expect(plan.issues).toEqual([]);
    expect(plan.rows[0]!.insert).toMatchObject({ status: 'on_hold', pay_min: 120000, pay_max: 150000, pay_currency: 'PHP', opened_date: '2026-10-01' });
  });

  it('skips an existing job code and rejects every invalid field with its row', () => {
    const plan = planRequisitions(
      [
        { Title: 'Dup', Account: 'Aster Analytics', Code: 'AA-1' },
        { Title: 'No account', Account: 'Unknown Co' },
        { Title: 'Bad status', Account: 'Aster Analytics', Status: 'paused' },
        { Title: 'Bad openings', Account: 'Aster Analytics', Openings: '0' },
        { Title: 'Pay order', Account: 'Aster Analytics', Min: '10', Max: '5' },
        { Title: 'Bad currency', Account: 'Aster Analytics', Currency: 'XYZ' },
        { Title: 'Bad date', Account: 'Aster Analytics', Opened: '2026-02-30' },
      ],
      REQ_MAP,
      companies,
      new Set(['aa-1']),
    );
    expect(plan.rows[0]!.skipReason).toBe('Job code AA-1 already exists');
    expect(plan.issues.map((issue) => issue.row)).toEqual([3, 4, 5, 6, 7, 8]);
    expect(plan.issues[0]!.message).toMatch(/does not exist/);
  });
});
