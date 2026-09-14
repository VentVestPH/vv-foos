import {
  RecordEditDialog,
  type EditField,
  type EditValue,
} from '../../../components/ui/RecordEditDialog';
import { PERSON_EDIT_FIELDS, personEditValues, savePerson } from '../../../components/ui/personEdit';
import { supabase } from '../../../lib/supabase';
import { useCompanyOptions } from '../hooks';
import type { ContactProfile, Person } from '../lib';

export interface ContactEditDialogProps {
  person: Person;
  profile: ContactProfile;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactEditDialog({ person, profile, onClose, onSaved }: ContactEditDialogProps) {
  const { companyOptions } = useCompanyOptions();

  const fields: EditField[] = [
    ...PERSON_EDIT_FIELDS,
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

  const values: Record<string, EditValue> = {
    ...personEditValues(person),
    company_id: profile.company_id ?? '',
    title: profile.title ?? '',
    since_date: profile.since_date ?? '',
    is_primary: profile.is_primary,
  };

  const save = async (draft: Record<string, EditValue>) => {
    await savePerson(person, draft);
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
    onSaved();
  };

  return (
    <RecordEditDialog
      title="Edit contact"
      fields={fields}
      values={values}
      onClose={onClose}
      onSave={save}
      footNote="Only the first email and phone are edited here. Extra addresses and numbers carried in from an import are left untouched."
    />
  );
}
