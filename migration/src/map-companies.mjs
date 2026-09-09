import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const TYPE_BY_ACCOUNT_TYPE = new Map([
  ['customer', 'client'],
  ['client', 'client'],
  ['prospect', 'prospect'],
  ['vendor', 'prospect'],
  ['partner', 'prospect'],
  ['reseller', 'prospect'],
  ['investor', 'prospect'],
  ['analyst', 'prospect'],
  ['press', 'prospect'],
  ['competitor', 'prospect'],
  ['integrator', 'prospect'],
  ['employer', 'employer'],
  ['other', 'prospect'],
]);

const PROFILE_COLUMNS = [
  ['Account Number', 'account_number'],
  ['Account Site', 'site'],
  ['Ticker Symbol', 'ticker'],
  ['Ownership', 'ownership'],
  ['Industry', 'industry'],
  ['Employees', 'employees'],
  ['Annual Revenue', 'annual_revenue'],
  ['SIC Code', 'sic_code'],
  ['Rating', 'rating'],
  ['Fax', 'fax'],
  ['Description', 'description'],
];

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

function normaliseWebsite(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function companyTypes(row, warnings) {
  const raw = trimmed(row, 'Account Type');
  if (!raw) return ['prospect'];
  const mapped = TYPE_BY_ACCOUNT_TYPE.get(raw.toLowerCase());
  if (!mapped) {
    warnings.push(`unmapped Account Type, defaulted to prospect: ${raw}`);
    return ['prospect'];
  }
  return [mapped];
}

export function mapCompany(row, lookups, unresolved) {
  const warnings = [];
  const zohoId = trimmed(row, 'Record Id');
  if (!zohoId) return { skip: 'no Record Id on the row', warnings };

  const name = trimmed(row, 'Account Name');
  if (!name) return { skip: 'no Account Name on the row', warnings };

  const createdAt = parseZohoTimestamp(row['Created Time']);
  const updatedAt = parseZohoTimestamp(row['Modified Time']);
  if (trimmed(row, 'Created Time') && !createdAt) {
    warnings.push(`unparseable Created Time: ${row['Created Time']}`);
  }

  const company = {
    name,
    types: companyTypes(row, warnings),
    website: normaliseWebsite(firstOf(row, ['Website'])),
    city: firstOf(row, ['Billing City', 'Shipping City']),
    state: firstOf(row, ['Billing Province', 'Shipping Province']),
    country: firstOf(row, ['Billing Country', 'Shipping Country']),
    phone: firstOf(row, ['Phone', 'Phone 1', 'Phone 2']),
    owner_id: resolveStaff(lookups, row['Account Owner'], unresolved),
    is_test: false,
  };
  if (createdAt) company.created_at = createdAt;
  if (updatedAt) company.updated_at = updatedAt;

  const carried = {};
  for (const [column, key] of PROFILE_COLUMNS) {
    const value = trimmed(row, column);
    if (value) carried[key] = value;
  }
  const street = firstOf(row, ['Billing Street', 'Shipping Street']);
  const postal = firstOf(row, ['Billing Code', 'Shipping Code']);
  if (street) carried.street = street;
  if (postal) carried.postal_code = postal;
  const email = firstOf(row, ['Email', 'Email 1', 'Email 2']);
  if (email) carried.email = email;
  const parent = trimmed(row, 'Parent Account');
  if (parent) carried.parent_account = parent;

  const COLUMNS_ON_COMPANIES = [
    'account_number',
    'description',
    'email',
    'industry',
    'postal_code',
    'site',
    'street',
  ];
  const leftover = {};
  for (const [key, value] of Object.entries(carried)) {
    if (COLUMNS_ON_COMPANIES.includes(key)) company[key] = value;
    else leftover[key] = value;
  }
  if (Object.keys(leftover).length > 0) {
    company.source_payload = leftover;
    warnings.push(
      `${Object.keys(leftover).length} field(s) have no column on companies and are kept in source_payload: ${Object.keys(leftover).sort().join(', ')}`,
    );
  }

  return { zohoId, company, carried, warnings };
}
