import type { EditField, EditValue } from '../../../components/ui/RecordEditDialog';
import { personEditFields, personEditValues, savePerson } from '../../../components/ui/personEdit';
import { supabase } from '../../../lib/supabase';
import type { ContactProfile, Person } from '../lib';

export function contactEditFields(
  person: Person,
  companyOptions: { value: string; label: string }[],
): EditField[] {
  return [
    ...personEditFields(person),
    {
      kind: 'select',
      key: 'company_id',
      label: 'Account',
      section: 'Role',
      options: companyOptions,
      placeholder: 'No account',
    },
    { kind: 'text', key: 'title', label: 'Title', section: 'Role' },
    { kind: 'date', key: 'since_date', label: 'Contact since', section: 'Role' },
    {
      kind: 'checkbox',
      key: 'is_primary',
      label: 'Primary contact for this account',
      section: 'Role',
      span: true,
    },
  ];
}

export function contactEditValues(person: Person, profile: ContactProfile): Record<string, EditValue> {
  return {
    ...personEditValues(person),
    company_id: profile.company_id ?? '',
    title: profile.title ?? '',
    since_date: profile.since_date ?? '',
    is_primary: profile.is_primary,
  };
}

export async function saveContact(person: Person, draft: Record<string, EditValue>): Promise<void> {
  await savePerson(person, draft, 'contact');
  const text = (v: EditValue | undefined) => (typeof v === 'string' ? v.trim() || null : null);
  const { error } = await supabase
    .from('contact_profiles')
    .update({
      company_id: text(draft.company_id),
      title: text(draft.title),
      since_date: text(draft.since_date),
      is_primary: draft.is_primary === true,
    })
    .eq('person_id', person.id);
  if (error) throw new Error(error.message);
}
