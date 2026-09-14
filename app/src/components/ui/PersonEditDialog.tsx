import { RecordEditDialog } from './RecordEditDialog';
import {
  PERSON_EDIT_FIELDS,
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
      fields={PERSON_EDIT_FIELDS}
      values={personEditValues(person)}
      onClose={onClose}
      onSave={async (draft) => {
        await savePerson(person, draft);
        onSaved();
      }}
      footNote="Only the first email and phone are edited here. Extra addresses and numbers carried in from an import are left untouched."
    />
  );
}
