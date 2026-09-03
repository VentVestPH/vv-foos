import { describe, expect, it } from 'vitest';
import { mapClient } from '../../migration/src/map-clients.mjs';
import { mapRecruitContact } from '../../migration/src/map-recruit-contacts.mjs';
import { mapLead } from '../../migration/src/map-leads.mjs';
import { mapCrmNote } from '../../migration/src/map-crm-notes.mjs';
import { mapRequisition } from '../../migration/src/map-requisitions.mjs';
import { newUnresolved, type Lookups } from '../../migration/src/lookups.mjs';

const lookups: Lookups = {
  staffByName: new Map([['john manager', 'staff-uuid']]),
  sourceByName: new Map(),
  statusByLabel: new Map(),
};

function defined<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`the mapper produced no ${what}`);
  return value;
}

const CLIENT_ZOHO_ID = '837085000000538531';
const COMPANY_BY_ZOHO_ID = new Map([[CLIENT_ZOHO_ID, 'company-uuid']]);

describe('mapClient, for the Recruit Clients module', () => {
  const row = {
    Id: CLIENT_ZOHO_ID,
    Client_Name: 'Ascend Global Careers',
    Account_Manager: 'John Manager',
    Contact_Number: '+63 2 555 0100',
    Website: 'ascend.example',
    Billing_City: 'Manila',
    Billing_State: 'Metro Manila',
    Billing_Country: 'Philippines',
    Industry: 'Staffing',
    Created_Time: '2026-05-04T21:12:16+08:00',
    Modified_Time: '2026-06-05T16:01:27+08:00',
  };

  it('maps a client onto the columns companies actually has', () => {
    const r = mapClient(row, lookups, newUnresolved());
    expect(r.skip).toBeUndefined();
    expect(r.zohoId).toBe(CLIENT_ZOHO_ID);
    const company = defined(r.company, 'company');
    expect(company.name).toBe('Ascend Global Careers');
    expect(company.types).toEqual(['client']);
    expect(company.website).toBe('https://ascend.example');
    expect(company.city).toBe('Manila');
    expect(company.country).toBe('Philippines');
    expect(company.phone).toBe('+63 2 555 0100');
    expect(company.owner_id).toBe('staff-uuid');
    expect(company.is_test).toBe(false);
  });

  it('keeps the Zoho timestamps rather than letting the row default to now', () => {
    const company = defined(mapClient(row, lookups, newUnresolved()).company, 'company');
    expect(String(company.created_at)).toContain('2026-05-04');
    expect(String(company.updated_at)).toContain('2026-06-05');
  });

  it('reports a field with no company column instead of dropping it silently', () => {
    const r = mapClient(row, lookups, newUnresolved());
    expect(defined(r.carried, 'carried').Industry).toBe('Staffing');
    expect(r.warnings.join(' ')).toContain('no column on companies');
  });

  it('skips a row with no client name, because companies.name is not nullable', () => {
    expect(mapClient({ Id: 'x' }, lookups, newUnresolved()).skip).toBe('no Client_Name');
  });
});

describe('mapRequisition resolves the client into company_id', () => {
  const row = {
    Id: 'req-1',
    Job_Opening_Name: 'Senior Analyst',
    Job_Opening_Status: 'In-progress',
    Client_Name: CLIENT_ZOHO_ID,
  };

  it('sets company_id when the client is imported', () => {
    const r = mapRequisition(row, lookups, newUnresolved(), COMPANY_BY_ZOHO_ID);
    expect(defined(r.requisition, 'requisition').company_id).toBe('company-uuid');
  });

  it('warns rather than failing when the client is not imported yet', () => {
    const r = mapRequisition(row, lookups, newUnresolved(), new Map());
    expect(defined(r.requisition, 'requisition').company_id).toBeNull();
    expect(r.warnings.join(' ')).toContain('client that is not imported');
  });

  it('writes the Zoho timestamps instead of letting the row default to the import time', () => {
    const r = mapRequisition(
      {
        ...row,
        Created_Time: '2025-11-14T08:30:00+08:00',
        Modified_Time: '2026-07-02T17:45:00+08:00',
      },
      lookups,
      newUnresolved(),
      COMPANY_BY_ZOHO_ID,
    );
    const requisition = defined(r.requisition, 'requisition');
    expect(String(requisition.created_at)).toContain('2025-11-14');
    expect(String(requisition.updated_at)).toContain('2026-07-02');
  });

  it('says so when Created_Time is missing, rather than silently stamping today', () => {
    const r = mapRequisition(row, lookups, newUnresolved(), COMPANY_BY_ZOHO_ID);
    expect(defined(r.requisition, 'requisition').created_at).toBeUndefined();
    expect(r.warnings.join(' ')).toContain('falls back to the import time');
  });
});

describe('mapRecruitContact, for the Recruit Contacts module', () => {
  const row = {
    Id: 'contact-1',
    First_Name: 'Dana',
    Last_Name: 'Reyes',
    Client_Name: CLIENT_ZOHO_ID,
    Job_Title: 'General Manager, APAC',
    Email: 'dana@ascend.example',
    Work_Phone: '+63 2 555 0111',
    Mobile: '+63 917 000 0000',
    Is_primary_contact: 'true',
    Department: 'Operations',
    Created_Time: '2026-04-01T10:00:00+08:00',
  };

  it('resolves the client id in Client_Name into a company', () => {
    const r = mapRecruitContact(row, lookups, newUnresolved(), COMPANY_BY_ZOHO_ID);
    expect(r.skip).toBeUndefined();
    expect(defined(r.profile, 'profile').company_id).toBe('company-uuid');
    expect(defined(r.profile, 'profile').title).toBe('General Manager, APAC');
    expect(defined(r.profile, 'profile').is_primary).toBe(true);
  });

  it('collects emails and phones into the jsonb shapes people uses', () => {
    const person = defined(
      mapRecruitContact(row, lookups, newUnresolved(), COMPANY_BY_ZOHO_ID).person,
      'person',
    );
    expect(person.emails).toEqual([{ type: 'work', address: 'dana@ascend.example' }]);
    expect(person.phones).toEqual([
      { type: 'main', number: '+63 2 555 0111' },
      { type: 'mobile', number: '+63 917 000 0000' },
    ]);
  });

  it('warns when the client is not imported, rather than writing a dangling company', () => {
    const r = mapRecruitContact(row, lookups, newUnresolved(), new Map());
    expect(defined(r.profile, 'profile').company_id).toBeNull();
    expect(r.warnings.join(' ')).toContain('client that is not imported');
  });
});

describe('mapLead, for the CRM Leads module', () => {
  const row = {
    Id: 'lead-1',
    First_Name: 'Sam',
    Last_Name: 'Cruz',
    Company: 'Sales & Marketing Coordinator Harcourts Takapuna',
    Designation: 'Coordinator',
    Email: 'sam@example.com',
    Phone: '+64 9 555 0100',
    Lead_Source: 'Referral',
    City: 'Auckland',
    Created_Time: '2026-03-02T09:00:00+08:00',
  };

  it('maps a lead to a person with a contact profile', () => {
    const r = mapLead(row, lookups, newUnresolved());
    expect(r.skip).toBeUndefined();
    const person = defined(r.person, 'person');
    expect(person.first_name).toBe('Sam');
    expect(person.city).toBe('Auckland');
    expect(defined(r.profile, 'profile').title).toBe('Coordinator');
  });

  it('does not invent a company row, because the Zoho values mix names with job titles', () => {
    const r = mapLead(row, lookups, newUnresolved());
    expect(defined(r.profile, 'profile').company_id).toBeNull();
    expect(r.warnings.join(' ')).toContain('kept on the imported note');
  });

  it('keeps the lead-only fields on a note so they survive in the database', () => {
    const note = defined(mapLead(row, lookups, newUnresolved()).leadNote, 'leadNote');
    expect(note.kind).toBe('note');
    expect(String(note.body)).toContain('Sales & Marketing Coordinator Harcourts Takapuna');
    expect(String(note.body)).toContain('Lead source: Referral');
  });

  it('omits occurred_at when Zoho has no usable timestamp, because the column is not nullable', () => {
    const note = defined(
      mapLead({ Id: 'l', Last_Name: 'Doe' }, lookups, newUnresolved()).leadNote,
      'leadNote',
    );
    expect('occurred_at' in note).toBe(false);
  });
});

describe('mapCrmNote, for the CRM Notes module', () => {
  const resolve = (entity: string, zohoId: string) =>
    entity === 'company' && zohoId === 'acct-1'
      ? 'company-uuid'
      : entity === 'contact' && zohoId === 'cont-1'
        ? 'person-uuid'
        : null;

  it('attaches an Accounts note to the company', () => {
    const r = mapCrmNote(
      {
        Id: 'note-1',
        $se_module: 'Accounts',
        Parent_Id: 'acct-1',
        Note_Content: 'Renewal discussed\nsecond line',
        Created_Time: '2026-02-01T09:00:00+08:00',
      },
      lookups,
      newUnresolved(),
      resolve,
    );
    expect(r.skip).toBeUndefined();
    const activity = defined(r.activity, 'activity');
    expect(activity.company_id).toBe('company-uuid');
    expect(activity.person_id).toBeNull();
  });

  it('derives a subject from the body when Note_Title is blank', () => {
    const activity = defined(
      mapCrmNote(
        {
          Id: 'note-2',
          $se_module: 'Accounts',
          Parent_Id: 'acct-1',
          Note_Title: '',
          Note_Content: 'Renewal discussed\nsecond line',
          Created_Time: '2026-02-01T09:00:00+08:00',
        },
        lookups,
        newUnresolved(),
        resolve,
      ).activity,
      'activity',
    );
    expect(activity.kind).toBe('note');
    expect(activity.subject).toBe('Renewal discussed');
  });

  it('attaches a Contacts note to the person', () => {
    const activity = defined(
      mapCrmNote(
        {
          Id: 'note-3',
          $se_module: 'Contacts',
          Parent_Id: 'cont-1',
          Note_Title: 'Call',
          Note_Content: 'Spoke about the role',
          Created_Time: '2026-02-01T09:00:00+08:00',
        },
        lookups,
        newUnresolved(),
        resolve,
      ).activity,
      'activity',
    );
    expect(activity.person_id).toBe('person-uuid');
    expect(activity.company_id).toBeNull();
    expect(activity.kind).toBe('call');
  });

  it('skips, and records the parent, when the parent is not imported', () => {
    const unresolved = newUnresolved();
    const r = mapCrmNote(
      {
        Id: 'note-4',
        $se_module: 'Leads',
        Parent_Id: 'lead-999',
        Note_Content: 'orphan',
        Created_Time: '2026-02-01T09:00:00+08:00',
      },
      lookups,
      unresolved,
      resolve,
    );
    expect(r.skip).toContain('parent lead not imported');
    expect(unresolved.parent.size).toBe(1);
  });

  it('skips a module it has no parent column for, rather than writing a dangling note', () => {
    const r = mapCrmNote(
      {
        Id: 'note-5',
        $se_module: 'Quotes',
        Parent_Id: 'q-1',
        Note_Content: 'x',
        Created_Time: '2026-02-01T09:00:00+08:00',
      },
      lookups,
      newUnresolved(),
      resolve,
    );
    expect(r.skip).toContain('unmapped $se_module: Quotes');
  });
});
