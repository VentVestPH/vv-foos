import { useMemo, type ReactNode } from 'react';
import { InlineRecordField } from './InlineField';
import {
  personEditFields,
  personEditValues,
  savePerson,
  type EditablePerson,
  type PersonKind,
} from './personEdit';

const REQUIRED_KEYS = ['first_name', 'last_name'];

interface PersonInlineFieldProps {
  person: EditablePerson;
  fieldKey: string;
  kind: PersonKind;
  editable: boolean;
  label?: string;
  display?: ReactNode;
  onSaved: () => void;
}

export function PersonInlineField({
  person,
  fieldKey,
  kind,
  editable,
  label,
  display,
  onSaved,
}: PersonInlineFieldProps) {
  const field = useMemo(
    () => personEditFields(person).find((f) => f.key === fieldKey),
    [person, fieldKey],
  );
  if (!field) return null;
  return (
    <InlineRecordField
      field={field}
      values={personEditValues(person)}
      editable={editable}
      required={kind === 'candidate' && REQUIRED_KEYS.includes(fieldKey)}
      {...(label === undefined ? {} : { label })}
      {...(display === undefined ? {} : { display })}
      onSave={async (draft) => {
        await savePerson(person, draft, kind);
        onSaved();
      }}
    />
  );
}
