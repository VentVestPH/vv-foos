import { parseZohoTimestamp } from './zoho.mjs';
import { resolveStaff } from './lookups.mjs';

const CARRIED_FIELDS = [
  'Industry',
  'About',
  'Fax',
  'Source',
  'Taleo_Client_ID',
  'No_of_Contacts_Associated',
  'Parent_Account',
  'Billing_Street',
  'Billing_Code',
  'Shipping_Street',
  'Shipping_City',
  'Shipping_State',
  'Shipping_Code',
  'Shipping_Country',
  'Currency',
  'Last_Update_In_Taleo',
  'Creation_Date',
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

function normaliseWebsite(value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function mapClient(row, lookups, unresolved) {
  const warnings = [];
  const zohoId = trimmed(row, 'Id') || trimmed(row, 'id');
  if (!zohoId) return { skip: 'no client id', warnings };

  const name = trimmed(row, 'Client_Name');
  if (!name) return { skip: 'no Client_Name', warnings };

  const company = {
    name,
    types: ['client'],
    website: normaliseWebsite(trimmed(row, 'Website') || null),
    city: firstOf(row, ['Billing_City', 'Shipping_City']),
    state: firstOf(row, ['Billing_State', 'Shipping_State']),
    country: firstOf(row, ['Billing_Country', 'Shipping_Country']),
    phone: trimmed(row, 'Contact_Number') || null,
    owner_id: resolveStaff(lookups, trimmed(row, 'Account_Manager'), unresolved),
    is_test: false,
  };

  const createdAt = parseZohoTimestamp(trimmed(row, 'Created_Time'));
  const updatedAt = parseZohoTimestamp(trimmed(row, 'Modified_Time'));
  if (trimmed(row, 'Created_Time') && !createdAt) {
    warnings.push(`unparseable Created_Time: ${trimmed(row, 'Created_Time')}`);
  }
  if (createdAt) company.created_at = createdAt;
  if (updatedAt) company.updated_at = updatedAt;

  const carried = {};
  for (const key of CARRIED_FIELDS) {
    const value = trimmed(row, key);
    if (value) carried[key] = value;
  }

  const unmapped = Object.keys(carried);
  if (unmapped.length) {
    warnings.push(
      `${unmapped.length} field(s) have no column on companies and are reported, not written: ${unmapped.sort().join(', ')}`,
    );
  }

  return { zohoId, company, carried, warnings };
}
