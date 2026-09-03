import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const EMAIL_FIELDS = [
  ['Email', 'work'],
  ['Secondary_Email', 'personal'],
];

const PHONE_FIELDS = [
  ['Work_Phone', 'main'],
  ['Mobile', 'mobile'],
  ['Fax', 'fax'],
];

const URL_FIELDS = ['Twitter', 'Facebook__s'];

const CARRIED_FIELDS = [
  'Department',
  'Salutation',
  'Skype_ID',
  'Source',
  'Campaign_Source',
  'Client_Portal_User_Status',
  'GDPR_Consent_Status',
  'Origin',
];

function trimmed(row, key) {
  const v = row[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return String(v.name ?? v.id ?? '').trim();
  return String(v).trim();
}

function firstOf(row, keys) {
  for (const key of keys) {
    const value = trimmed(row, key);
    if (value) return value;
  }
  return null;
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

function isTrue(value) {
  return /^(true|yes|1)$/i.test(String(value ?? '').trim());
}

export function mapRecruitContact(row, lookups, unresolved, companyByZohoId) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no contact id', warnings };

  const first = trimmed(row, 'First_Name') || null;
  const last = trimmed(row, 'Last_Name') || null;
  if (!first && !last) return { skip: 'no name on the row', warnings };

  const person = {
    first_name: first,
    last_name: last,
    headline: trimmed(row, 'Description') || null,
    emails: collect(row, EMAIL_FIELDS, 'address'),
    phones: collect(row, PHONE_FIELDS, 'number'),
    street: firstOf(row, ['Mailing_Street', 'Other_Street']),
    city: firstOf(row, ['Mailing_City', 'Other_City']),
    state: firstOf(row, ['Mailing_State', 'Other_State']),
    postal_code: firstOf(row, ['Mailing_Zip', 'Other_Zip']),
    country: firstOf(row, ['Mailing_Country', 'Other_Country']),
    linkedin_public_url: trimmed(row, 'LinkedIn__s') || null,
    other_urls: URL_FIELDS.map((key) => trimmed(row, key)).filter(Boolean),
    education: [],
    experience: [],
    is_test: false,
    created_by: resolveStaff(lookups, trimmed(row, 'Created_By'), unresolved),
  };

  const createdAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const updatedAt = parseZohoTimestamp(trimmed(row, 'Modified_Time'));
  if (createdAt) person.created_at = createdAt;
  if (updatedAt) person.updated_at = updatedAt;

  const clientZohoId = trimmed(row, 'Client_Name');
  const companyId = clientZohoId ? (companyByZohoId.get(clientZohoId) ?? null) : null;
  if (clientZohoId && !companyId) {
    warnings.push('contact references a client that is not imported yet');
  }

  const profile = {
    company_id: companyId,
    title: trimmed(row, 'Job_Title') || null,
    is_primary: isTrue(row.Is_primary_contact),
    since_date: null,
  };

  const carried = {};
  for (const key of CARRIED_FIELDS) {
    const value = trimmed(row, key);
    if (value) carried[key] = value;
  }

  return { zohoId, person, profile, carried, warnings };
}
