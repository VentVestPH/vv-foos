import { describe, expect, it } from 'vitest';
import { companyTypes, mapCompany } from '../../migration/src/map-companies.mjs';
import { mapContact, unrecognisedContactColumns } from '../../migration/src/map-contacts.mjs';

const lookups = {
  staffByName: new Map([['ada owner', 'staff-uuid']]),
  sourceByName: new Map(),
  statusByLabel: new Map(),
};

function unresolved() {
  return { staff: new Map(), source: new Map(), status: new Map() };
}

const ACCOUNT = {
  'Record Id': 'zcrm_1',
  'Account Name': 'Northwind Freight',
  'Account Owner': 'Ada Owner',
  'Account Type': 'Partner',
  Website: 'northwind.example',
  Phone: '+63 2 555 0100',
  'Billing City': 'Manila',
  'Billing Province': 'Metro Manila',
  'Billing Country': 'Philippines',
  'Created Time': '2026-09-02 14:31:07',
  'Modified Time': '2026-09-02 15:00:00',
  Industry: 'Logistics',
  'Annual Revenue': '1000000',
};

describe('mapCompany', () => {
  it('maps the columns companies actually has', () => {
    const r = mapCompany(ACCOUNT, lookups, unresolved());
    expect(r.skip).toBeUndefined();
    expect(r.zohoId).toBe('zcrm_1');
    expect(r.company.name).toBe('Northwind Freight');
    expect(r.company.city).toBe('Manila');
    expect(r.company.state).toBe('Metro Manila');
    expect(r.company.country).toBe('Philippines');
    expect(r.company.phone).toBe('+63 2 555 0100');
    expect(r.company.owner_id).toBe('staff-uuid');
    expect(r.company.is_test).toBe(false);
  });

  it('gives a bare domain a scheme so the link works', () => {
    expect(mapCompany(ACCOUNT, lookups, unresolved()).company.website).toBe('https://northwind.example');
    expect(
      mapCompany({ ...ACCOUNT, Website: 'http://already.example' }, lookups, unresolved()).company.website,
    ).toBe('http://already.example');
  });

  it('parses the CRM timestamp shape, which differs from Recruit', () => {
    const r = mapCompany(ACCOUNT, lookups, unresolved());
    expect(r.company.created_at).toBe('2026-09-02T14:31:07Z');
    expect(r.company.updated_at).toBe('2026-09-02T15:00:00Z');
    expect(r.warnings.filter((w: string) => w.includes('Created Time'))).toHaveLength(0);
  });

  it('only ever emits a type the companies CHECK allows', () => {
    const allowed = ['client', 'employer', 'prospect'];
    for (const type of ['Customer', 'Partner', 'Vendor', 'Investor', '', 'Something New']) {
      const types = companyTypes({ 'Account Type': type }, []);
      expect(types).toHaveLength(1);
      expect(allowed).toContain(types[0]);
    }
  });

  it('warns on an Account Type it does not know instead of inventing one', () => {
    const warnings: string[] = [];
    expect(companyTypes({ 'Account Type': 'Franchisee' }, warnings)).toEqual(['prospect']);
    expect(warnings.join(' ')).toContain('unmapped Account Type');
  });

  it('reports source fields that have no column rather than dropping them silently', () => {
    const r = mapCompany(ACCOUNT, lookups, unresolved());
    expect(r.carried.industry).toBe('Logistics');
    expect(r.carried.annual_revenue).toBe('1000000');
    expect(r.warnings.join(' ')).toContain('no column on companies');
  });

  it('skips a row with no id or no name', () => {
    expect(mapCompany({ ...ACCOUNT, 'Record Id': '' }, lookups, unresolved()).skip).toContain('Record Id');
    expect(mapCompany({ ...ACCOUNT, 'Account Name': '' }, lookups, unresolved()).skip).toContain('Account Name');
  });
});

const CONTACT = {
  'Record Id': 'zcrm_c1',
  'First Name': 'Bo',
  'Last Name': 'Reyes',
  Title: 'Head of Ops',
  Email: 'bo@northwind.example',
  'Secondary Email': 'bo.personal@example.com',
  Mobile: '+63 917 000 0000',
  Phone: '+63 2 555 0100',
  'Mailing City': 'Cebu',
  'Account Name': 'Northwind Freight',
  'Account Name.id': 'zcrm_1',
  'Created Time': '2026-09-02 14:31:07',
};

describe('mapContact', () => {
  const companies = new Map([['zcrm_1', 'company-uuid']]);

  it('builds the people row and the contact_profiles row together', () => {
    const r = mapContact(CONTACT, lookups, unresolved(), companies);
    expect(r.skip).toBeUndefined();
    expect(r.person.first_name).toBe('Bo');
    expect(r.person.city).toBe('Cebu');
    expect(r.profile.title).toBe('Head of Ops');
    expect(r.profile.company_id).toBe('company-uuid');
  });

  it('types the emails and phones it collects and drops duplicates', () => {
    const r = mapContact({ ...CONTACT, 'Email 1': 'bo@northwind.example' }, lookups, unresolved(), companies);
    expect(r.person.emails).toEqual([
      { type: 'work', address: 'bo@northwind.example' },
      { type: 'personal', address: 'bo.personal@example.com' },
    ]);
    expect(r.person.phones.map((p: { type: string }) => p.type)).toEqual(['main', 'mobile']);
  });

  it('warns when the account it points at is not imported yet', () => {
    const r = mapContact(CONTACT, lookups, unresolved(), new Map());
    expect(r.profile.company_id).toBeNull();
    expect(r.warnings.join(' ')).toContain('not imported yet');
  });

  it('skips a row with no name at all', () => {
    expect(
      mapContact({ ...CONTACT, 'First Name': '', 'Last Name': '' }, lookups, unresolved(), companies).skip,
    ).toContain('no name');
  });

  it('names export columns it does not recognise so a wrong guess is visible', () => {
    expect(unrecognisedContactColumns(['Record Id', 'First Name', 'Custom Field 7'])).toEqual(['Custom Field 7']);
  });
});
