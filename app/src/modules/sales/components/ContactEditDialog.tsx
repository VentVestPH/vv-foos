import { RecordEditDialog, type EditValue } from '../../../components/ui/RecordEditDialog';
import { useCompanyOptions } from '../hooks';
import type { ContactProfile, Person } from '../lib';
import { contactEditFields, contactEditValues, saveContact } from './contactEdit';

export interface ContactEditDialogProps {
  person: Person;
  profile: ContactProfile;
  onClose: () => void;
  onSaved: () => void;
}

export function ContactEditDialog({ person, profile, onClose, onSaved }: ContactEditDialogProps) {
  const { companyOptions } = useCompanyOptions();

  const save = async (draft: Record<string, EditValue>) => {
    await saveContact(person, draft);
    onSaved();
  };

  return (
    <RecordEditDialog
      title="Edit contact"
      fields={contactEditFields(person, companyOptions)}
      values={contactEditValues(person, profile)}
      onClose={onClose}
      onSave={save}
      footNote="Only the first email and phone are edited here. Extra addresses and numbers carried in from an import are left untouched."
    />
  );
}
