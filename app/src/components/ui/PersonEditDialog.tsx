import { RecordEditDialog } from './RecordEditDialog';
import {
  personEditFields,
  personEditValues,
  savePerson,
  type EditablePerson,
} from './personEdit';

export interface PersonEditDialogProps {
  person: EditablePerson;
  onClose: () => void;
  onSaved: () => void;
}

export function PersonEditDialog({ person, onClose, onSaved }: PersonEditDialogProps) {
  return (
    <RecordEditDialog
      title="Edit person details"
      fields={personEditFields(person)}
      values={personEditValues(person)}
      required={['first_name', 'last_name', 'email']}
      onClose={onClose}
      onSave={async (draft) => {
        await savePerson(person, draft, 'candidate');
        onSaved();
      }}
      footNote="Only the first email and phone are edited here. Extra addresses and numbers carried in from an import are left untouched."
    />
  );
}
