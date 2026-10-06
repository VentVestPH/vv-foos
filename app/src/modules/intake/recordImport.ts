import { REQUISITION_STATUSES, type CompanyType, type RequisitionStatus, type TablesInsert } from '../../lib/database.types';
import { CURRENCIES } from '../../lib/format';
import { EMAIL_PATTERN, PHONE_PATTERN, PHONE_RULE } from '../../lib/personValidation';

export type DirectTarget = 'account' | 'requisition';

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

export interface RowIssue {
  row: number;
  message: string;
}

export interface PlannedRow<T> {
  row: number;
  label: string;
  insert: T | null;
  skipReason: string | null;
}

export interface ImportPlan<T> {
  rows: PlannedRow<T>[];
  issues: RowIssue[];
}

type Sheet = Record<string, string>[];
type ColumnMap = Record<string, string>;
type CompanyInsert = TablesInsert<'companies'>;
type RequisitionInsert = TablesInsert<'requisitions'>;

const COMPANY_TYPES: CompanyType[] = ['client', 'employer', 'prospect'];

export const ACCOUNT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Account name', required: true },
  { key: 'types', label: 'Type (client, employer, prospect)' },
  { key: 'industry', label: 'Industry' },
  { key: 'website', label: 'Website' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State / region' },
  { key: 'postal_code', label: 'Postal code' },
  { key: 'country', label: 'Country' },
  { key: 'description', label: 'Description' },
];

export const REQUISITION_FIELDS: ImportField[] = [
  { key: 'title', label: 'Title', required: true },
  { key: 'account', label: 'Account name', required: true },
  { key: 'job_code', label: 'Job code' },
  { key: 'status', label: 'Status (draft, open, on hold, filled, closed)' },
  { key: 'location', label: 'Location' },
  { key: 'employment_type', label: 'Employment type' },
  { key: 'num_openings', label: 'Openings' },
  { key: 'pay_min', label: 'Pay minimum' },
  { key: 'pay_max', label: 'Pay maximum' },
  { key: 'pay_currency', label: 'Pay currency' },
  { key: 'opened_date', label: 'Opened date (YYYY-MM-DD)' },
  { key: 'description', label: 'Description' },
];

export const ACCOUNT_TEMPLATE: Record<string, string> = {
  name: 'Northwind Logistics',
  types: 'client',
  industry: 'Logistics',
  website: 'https://northwind.example',
  email: 'hello@northwind.example',
  phone: '+63 2 8123 4567',
  street: '1 Ayala Avenue',
  city: 'Makati',
  state: 'Metro Manila',
  postal_code: '1226',
  country: 'Philippines',
  description: 'Regional freight forwarder',
};

export const REQUISITION_TEMPLATE: Record<string, string> = {
  title: 'Staff Platform Engineer',
  account: 'Northwind Logistics',
  job_code: 'NW-PLAT-01',
  status: 'draft',
  location: 'Makati',
  employment_type: 'Full-time',
  num_openings: '1',
  pay_min: '120000',
  pay_max: '150000',
  pay_currency: 'PHP',
  opened_date: '2026-10-01',
  description: 'Lead the platform team',
};

export function fieldsFor(target: DirectTarget): ImportField[] {
  return target === 'account' ? ACCOUNT_FIELDS : REQUISITION_FIELDS;
}

export function missingRequiredMappings(target: DirectTarget, map: ColumnMap): string[] {
  return fieldsFor(target).filter((field) => field.required && !map[field.key]).map((field) => field.label);
}

function reader(map: ColumnMap) {
  return (row: Record<string, string>, key: string): string => {
    const column = map[key];
    const value = column ? row[column] : undefined;
    return value === undefined || value === null ? '' : String(value).trim();
  };
}

function websiteValue(raw: string): string | null {
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

export function planAccounts(rows: Sheet, map: ColumnMap, existingNames: Set<string>): ImportPlan<CompanyInsert> {
  const read = reader(map);
  const issues: RowIssue[] = [];
  const seen = new Set<string>();
  const planned = rows.map((row, index): PlannedRow<CompanyInsert> => {
    const line = index + 2;
    const name = read(row, 'name');
    const fail = (message: string) => {
      issues.push({ row: line, message });
      return { row: line, label: name || '(no name)', insert: null, skipReason: null };
    };
    if (!name) return fail('the account name is required.');
    const key = name.toLowerCase();
    if (existingNames.has(key)) return { row: line, label: name, insert: null, skipReason: 'An account with this name already exists' };
    if (seen.has(key)) return { row: line, label: name, insert: null, skipReason: 'Repeated earlier in this sheet' };
    seen.add(key);

    const typesRaw = read(row, 'types');
    const types = typesRaw ? typesRaw.split(/[,;/]+/).map((value) => value.trim().toLowerCase()).filter(Boolean) : ['prospect'];
    const unknown = types.filter((value) => !(COMPANY_TYPES as string[]).includes(value));
    if (unknown.length) return fail(`type ${unknown.join(', ')} is not one of client, employer or prospect.`);
    const email = read(row, 'email');
    if (email && !EMAIL_PATTERN.test(email)) return fail('enter a valid email address.');
    const phone = read(row, 'phone');
    if (phone && !PHONE_PATTERN.test(phone)) return fail(PHONE_RULE.replace(/^Phone/, 'phone'));
    const websiteRaw = read(row, 'website');
    const website = websiteRaw ? websiteValue(websiteRaw) : null;
    if (websiteRaw && !website) return fail('the website is not a valid web address.');

    const optional = (key: string) => read(row, key) || null;
    return {
      row: line,
      label: name,
      skipReason: null,
      insert: {
        name,
        types: [...new Set(types)] as CompanyType[],
        industry: optional('industry'),
        website,
        email: email || null,
        phone: phone || null,
        street: optional('street'),
        city: optional('city'),
        state: optional('state'),
        postal_code: optional('postal_code'),
        country: optional('country'),
        description: optional('description'),
      },
    };
  });
  return { rows: planned, issues };
}

function parseStatus(raw: string): RequisitionStatus | null {
  if (!raw) return 'draft';
  const normalised = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return (REQUISITION_STATUSES as string[]).includes(normalised) ? (normalised as RequisitionStatus) : null;
}

function parseAmount(raw: string): number | null | undefined {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : undefined;
}

function validIsoDate(raw: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

export function planRequisitions(
  rows: Sheet,
  map: ColumnMap,
  companyIdByName: Map<string, string>,
  existingJobCodes: Set<string>,
): ImportPlan<RequisitionInsert> {
  const read = reader(map);
  const issues: RowIssue[] = [];
  const seenCodes = new Set<string>();
  const planned = rows.map((row, index): PlannedRow<RequisitionInsert> => {
    const line = index + 2;
    const title = read(row, 'title');
    const fail = (message: string) => {
      issues.push({ row: line, message });
      return { row: line, label: title || '(no title)', insert: null, skipReason: null };
    };
    if (!title) return fail('the requisition title is required.');
    const account = read(row, 'account');
    if (!account) return fail('the account name is required.');
    const companyId = companyIdByName.get(account.toLowerCase());
    if (!companyId) return fail(`account “${account}” does not exist. Import or create the account first.`);

    const jobCode = read(row, 'job_code');
    const codeKey = jobCode.toLowerCase();
    if (jobCode && existingJobCodes.has(codeKey)) return { row: line, label: title, insert: null, skipReason: `Job code ${jobCode} already exists` };
    if (jobCode && seenCodes.has(codeKey)) return { row: line, label: title, insert: null, skipReason: 'Repeated earlier in this sheet' };
    if (jobCode) seenCodes.add(codeKey);

    const status = parseStatus(read(row, 'status'));
    if (!status) return fail(`status “${read(row, 'status')}” is not one of ${REQUISITION_STATUSES.join(', ').replace(/_/g, ' ')}.`);
    const openingsRaw = read(row, 'num_openings');
    const openings = openingsRaw ? Number(openingsRaw) : 1;
    if (!Number.isInteger(openings) || openings < 1) return fail('openings must be a whole number of at least 1.');
    const payMin = parseAmount(read(row, 'pay_min'));
    const payMax = parseAmount(read(row, 'pay_max'));
    if (payMin === undefined || payMax === undefined) return fail('pay amounts must be numbers.');
    if (payMin !== null && payMax !== null && payMin > payMax) return fail('the pay minimum is above the pay maximum.');
    const currency = read(row, 'pay_currency').toUpperCase();
    if (currency && !CURRENCIES.includes(currency)) return fail(`pay currency ${currency} is not one of ${CURRENCIES.join(', ')}.`);
    const opened = read(row, 'opened_date');
    if (opened && !validIsoDate(opened)) return fail('the opened date must be a real date written YYYY-MM-DD.');

    const optional = (key: string) => read(row, key) || null;
    return {
      row: line,
      label: title,
      skipReason: null,
      insert: {
        title,
        company_id: companyId,
        job_code: jobCode || null,
        status,
        location: optional('location'),
        employment_type: optional('employment_type'),
        num_openings: openings,
        pay_min: payMin,
        pay_max: payMax,
        pay_currency: currency || null,
        opened_date: opened || null,
        description: optional('description'),
      },
    };
  });
  return { rows: planned, issues };
}
