import type { EditField, EditValue } from '../../../components/ui/RecordEditDialog';
import { supabase } from '../../../lib/supabase';
import type { CompanyType } from '../../../lib/database.types';
import type { Company } from '../lib';
import { EMAIL_PATTERN, PHONE_PATTERN, PHONE_RULE } from '../../../lib/personValidation';
import { countryOptions } from '../../../lib/countries';

const ALL_TYPES: CompanyType[] = ['client', 'employer', 'prospect'];

export function companyEditFields(
  company: Company,
  staffOptions: { value: string; label: string }[],
): EditField[] {
  return [
    { kind: 'text', key: 'name', label: 'Name', section: 'Account', span: true },
    { kind: 'checkgroup', key: 'types', label: 'Types', section: 'Account', options: ALL_TYPES },
    { kind: 'text', key: 'account_number', label: 'Account number', section: 'Account' },
    { kind: 'text', key: 'industry', label: 'Industry', section: 'Account' },
    { kind: 'url', key: 'website', label: 'Website', section: 'Contact', placeholder: 'https://…' },
    { kind: 'url', key: 'site', label: 'Site', section: 'Contact' },
    { kind: 'email', key: 'email', label: 'Email', section: 'Contact' },
    { kind: 'text', key: 'phone', label: 'Phone', section: 'Contact', placeholder: '+63 2 8123 4567' },
    { kind: 'text', key: 'street', label: 'Street', section: 'Location', span: true },
    { kind: 'text', key: 'city', label: 'City', section: 'Location' },
    { kind: 'text', key: 'state', label: 'State / region', section: 'Location' },
    { kind: 'text', key: 'postal_code', label: 'Postal code', section: 'Location' },
    { kind: 'select', key: 'country', label: 'Country', section: 'Location', options: countryOptions(company.country), placeholder: 'No country' },
    { kind: 'select', key: 'owner_id', label: 'Owner', section: 'Ownership', options: staffOptions, placeholder: 'Unassigned' },
    { kind: 'textarea', key: 'description', label: 'Description', section: 'Ownership' },
    { kind: 'checkbox', key: 'is_test', label: 'Demo record (is_test)', section: 'Ownership' },
  ];
}

export function companyEditValues(company: Company): Record<string, EditValue> {
  return {
    name: company.name,
    types: company.types,
    account_number: company.account_number ?? '',
    industry: company.industry ?? '',
    website: company.website ?? '',
    site: company.site ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
    street: company.street ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    postal_code: company.postal_code ?? '',
    country: company.country ?? '',
    owner_id: company.owner_id ?? '',
    description: company.description ?? '',
    is_test: company.is_test,
  };
}

const text = (v: EditValue | undefined) => (typeof v === 'string' ? v.trim() || null : null);

export async function saveCompany(
  company: Company,
  draft: Record<string, EditValue>,
): Promise<void> {
  const name = String(draft.name ?? '').trim();
  if (name === '') throw new Error('Name cannot be empty.');
  const phone = text(draft.phone);
  if (phone && !PHONE_PATTERN.test(phone)) throw new Error(PHONE_RULE);
  const email = text(draft.email);
  if (email && !EMAIL_PATTERN.test(email)) throw new Error('Enter a valid email address.');
  const { error } = await supabase
    .from('companies')
    .update({
      name,
      types: (Array.isArray(draft.types) ? draft.types : []) as CompanyType[],
      account_number: text(draft.account_number),
      industry: text(draft.industry),
      website: text(draft.website),
      site: text(draft.site),
      email,
      phone,
      street: text(draft.street),
      city: text(draft.city),
      state: text(draft.state),
      postal_code: text(draft.postal_code),
      country: text(draft.country),
      owner_id: text(draft.owner_id),
      description: text(draft.description),
      is_test: draft.is_test === true,
    })
    .eq('id', company.id);
  if (error) throw new Error(error.message);
}
