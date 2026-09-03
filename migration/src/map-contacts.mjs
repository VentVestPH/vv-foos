import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const EMAIL_COLUMNS = [
  ['Email', 'work'],
  ['Secondary Email', 'personal'],
  ['Email 1', 'work'],
  ['Email 2', 'personal'],
];

const PHONE_COLUMNS = [
  ['Phone', 'main'],
  ['Mobile', 'mobile'],
  ['Home Phone', 'home'],
  ['Other Phone', 'other'],
  ['Asst Phone', 'other'],
  ['Phone 1', 'main'],
  ['Phone 2', 'other'],
];

const URL_COLUMNS = ['Website', 'Twitter', 'X (formerly Twitter)', 'Facebook', 'LinkedIn'];

const KNOWN_COLUMNS = new Set([
  'Record Id',
  'Contact Owner',
  'Contact Owner.id',
  'First Name',
  'Last Name',
  'Middle Name',
  'Salutation',
  'Full Name',
  'Title',
  'Department',
  'Account Name',
  'Account Name.id',
  'Mailing Street',
  'Mailing City',
  'Mailing Province',
  'Mailing Zip',
  'Mailing Country',
  'Other Street',
  'Other City',
  'Other Province',
  'Other Zip',
  'Other Country',
  'Description',
  'Created Time',
  'Modified Time',
  'Created By',
  'Created By.id',
  'Modified By',
  'Modified By.id',
  'Date of Birth',
  'Fax',
  'Lead Source',
  'Reports To',
  'Reports To.id',
  'Email Opt Out',
  'Locked',
  'Last Activity Time',
  'Change Log Time',
  'Enrich Status',
  'Last Enriched Time',
  ...EMAIL_COLUMNS.map(([c]) => c),
  ...PHONE_COLUMNS.map(([c]) => c),
  ...URL_COLUMNS,
]);

function trimmed(row, column) {
  return (row[column] ?? '').trim() || null;
}

function firstOf(row, columns) {
  for (const column of columns) {
    const value = trimmed(row, column);
    if (value) return value;
  }
  return null;
}

function collect(row, columns, key) {
  const out = [];
  const seen = new Set();
  for (const [column, type] of columns) {
    const value = trimmed(row, column);
    if (!value) continue;
    const dedupe = value.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    out.push({ type, [key]: value });
  }
  return out;
}

export function unrecognisedContactColumns(header) {
  return header.filter((column) => column && !KNOWN_COLUMNS.has(column));
}

export function mapContact(row, lookups, unresolved, companyByZohoId) {
  const warnings = [];
  const zohoId = trimmed(row, 'Record Id');
  if (!zohoId) return { skip: 'no Record Id on the row', warnings };

  const first = trimmed(row, 'First Name');
  const last = trimmed(row, 'Last Name');
  if (!first && !last) return { skip: 'no name on the row', warnings };

  const createdAt = parseZohoTimestamp(row['Created Time']);
  const updatedAt = parseZohoTimestamp(row['Modified Time']);
  if (trimmed(row, 'Created Time') && !createdAt) {
    warnings.push(`unparseable Created Time: ${row['Created Time']}`);
  }

  const person = {
    first_name: first,
    middle_name: trimmed(row, 'Middle Name'),
    last_name: last,
    headline: trimmed(row, 'Description'),
    emails: collect(row, EMAIL_COLUMNS, 'address'),
    phones: collect(row, PHONE_COLUMNS, 'number'),
    street: firstOf(row, ['Mailing Street', 'Other Street']),
    city: firstOf(row, ['Mailing City', 'Other City']),
    state: firstOf(row, ['Mailing Province', 'Other Province']),
    postal_code: firstOf(row, ['Mailing Zip', 'Other Zip']),
    country: firstOf(row, ['Mailing Country', 'Other Country']),
    linkedin_public_url: trimmed(row, 'LinkedIn'),
    other_urls: URL_COLUMNS.filter((c) => c !== 'LinkedIn')
      .map((c) => trimmed(row, c))
      .filter(Boolean),
    education: [],
    experience: [],
    is_test: false,
    created_by: resolveStaff(lookups, row['Created By'], unresolved),
  };
  if (createdAt) person.created_at = createdAt;
  if (updatedAt) person.updated_at = updatedAt;

  const accountRef = trimmed(row, 'Account Name');
  const accountZohoId =
    trimmed(row, 'Account Name.id') || (/^\d{10,}$/.test(accountRef ?? '') ? accountRef : null);
  const companyId = accountZohoId ? (companyByZohoId.get(accountZohoId) ?? null) : null;
  if (accountRef && !companyId) {
    warnings.push('contact references an account that is not imported yet');
  }

  const profile = {
    company_id: companyId,
    title: trimmed(row, 'Title'),
    is_primary: false,
    since_date: null,
  };

  return { zohoId, person, profile, warnings };
}
