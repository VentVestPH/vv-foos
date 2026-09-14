import {
  ConfirmDeleteDialog,
  ConfirmDeleteList,
} from '../../../components/ui/ConfirmDeleteDialog';
import { supabase } from '../../../lib/supabase';

const NAMED_LIMIT = 8;

export interface ContactDeleteTarget {
  personId: string;
  name: string;
  companyName: string | null;
}

export interface ContactDeleteDialogProps {
  targets: ContactDeleteTarget[];
  onClose: () => void;
  onDeleted: (deleted: number, refused: number) => void;
}

export function ContactDeleteDialog({ targets, onClose, onDeleted }: ContactDeleteDialogProps) {
  const remove = async () => {
    const { data, error } = await supabase
      .from('contact_profiles')
      .delete()
      .in(
        'person_id',
        targets.map((t) => t.personId),
      )
      .select('person_id');
    if (error) throw new Error(error.message);
    const deleted = (data ?? []).length;
    onDeleted(deleted, targets.length - deleted);
  };

  return (
    <ConfirmDeleteDialog
      wide
      title={targets.length === 1 ? 'Delete contact' : `Delete ${targets.length} contacts`}
      onClose={onClose}
      onConfirm={remove}
    >
      <p>
        {targets.length === 1 ? 'This person stops' : 'These people stop'} being a contact and
        {targets.length === 1 ? ' leaves' : ' leave'} the list.
      </p>
      <ConfirmDeleteList>
        {targets.slice(0, NAMED_LIMIT).map((t) => (
          <li key={t.personId}>
            <span className="fo-confirm-name">{t.name}</span>
            {t.companyName && <span className="text-secondary"> {t.companyName}</span>}
          </li>
        ))}
        {targets.length > NAMED_LIMIT && (
          <li className="text-secondary">and {targets.length - NAMED_LIMIT} more</li>
        )}
      </ConfirmDeleteList>
      <p className="text-secondary">
        The person record itself stays, along with any candidate history, applications and logged
        activity. Erasing a person outright is a separate action on their candidate record, because
        it removes their applications with them.
      </p>
    </ConfirmDeleteDialog>
  );
}
