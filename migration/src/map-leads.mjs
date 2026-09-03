import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const EMAIL_FIELDS = [
  ['Email', 'work'],
  ['Secondary_Email', 'personal'],
];

const PHONE_FIELDS = [
  ['Phone', 'main'],
  ['Mobile', 'mobile'],
  ['Fax', 'fax'],
];

const LEAD_ATTRIBUTES = [
  ['Company', 'Company'],
  ['Lead_Source', 'Lead source'],
  ['Lead_Status', 'Lead status'],
  ['Rating', 'Rating'],
  ['Industry', 'Industry'],
  ['No_of_Employees', 'Employees'],
  ['Annual_Revenue', 'Annual revenue'],
  ['Website', 'Website'],
  ['Skype_ID', 'Skype'],
  ['Twitter', 'Twitter'],
  ['Description', 'Description'],
];

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

function collect(row, fields, valueKey) {
  const out = [];
  const seen = new Set();
  for (const [key, type] of fields) {
    const value = trimmed(row, key);
    if (!value) continue;
    const dedupe = value.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ type, [valueKey]: value });
  }
  return out;
}

export function mapLead(row, lookups, unresolved) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no lead id', warnings };

  const first = trimmed(row, 'First_Name') || null;
  const last = trimmed(row, 'Last_Name') || null;
  if (!first && !last) return { skip: 'no name on the row', warnings };

  const person = {
    first_name: first,
    last_name: last,
    headline: trimmed(row, 'Designation') || null,
    emails: collect(row, EMAIL_FIELDS, 'address'),
    phones: collect(row, PHONE_FIELDS, 'number'),
    street: trimmed(row, 'Street') || null,
    city: trimmed(row, 'City') || null,
    state: trimmed(row, 'State') || null,
    postal_code: trimmed(row, 'Zip_Code') || null,
    country: trimmed(row, 'Country') || null,
    other_urls: [trimmed(row, 'Website')].filter(Boolean),
    education: [],
    experience: [],
    is_test: false,
    created_by: resolveStaff(lookups, trimmed(row, 'Created_By'), unresolved),
  };

  const createdAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const updatedAt = parseZohoTimestamp(trimmed(row, 'Modified_Time'));
  if (createdAt) person.created_at = createdAt;
  if (updatedAt) person.updated_at = updatedAt;

  const profile = {
    company_id: null,
    title: trimmed(row, 'Designation') || null,
    is_primary: false,
    since_date: null,
  };

  const attributes = [];
  for (const [key, label] of LEAD_ATTRIBUTES) {
    const value = trimmed(row, key);
    if (value) attributes.push(`${label}: ${value}`);
  }

  const leadNote = {
    kind: 'note',
    subject: 'Imported from Zoho CRM Leads',
    body: attributes.join('\n') || null,
    created_by: person.created_by,
  };
  const noteAt = createdAt ?? updatedAt;
  if (noteAt) leadNote.occurred_at = noteAt;

  const company = trimmed(row, 'Company');
  if (company) {
    warnings.push(
      'lead Company is kept on the imported note rather than creating a company row, ' +
        'because the Zoho values mix company names with job titles',
    );
  }

  return { zohoId, person, profile, leadNote, warnings };
}
