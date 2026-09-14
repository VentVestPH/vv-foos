import {
  ConfirmDeleteDialog,
  ConfirmDeleteList,
} from '../../../components/ui/ConfirmDeleteDialog';
import { supabase } from '../../../lib/supabase';
import { STATUS_LABEL, type IntakeItem } from '../lib';

export interface IntakeDeleteDialogProps {
  items: IntakeItem[];
  onClose: () => void;
  onDeleted: (deleted: number, refused: number) => void;
}

const NAMED_LIMIT = 8;

export function IntakeDeleteDialog({ items, onClose, onDeleted }: IntakeDeleteDialogProps) {
  const imported = items.filter((i) => i.status === 'imported');

  const remove = async () => {
    const { data, error } = await supabase
      .from('intake_items')
      .delete()
      .in(
        'id',
        items.map((i) => i.id),
      )
      .select('id');
    if (error) throw new Error(error.message);
    const deleted = (data ?? []).length;
    onDeleted(deleted, items.length - deleted);
  };

  return (
    <ConfirmDeleteDialog
      wide
      title={items.length === 1 ? 'Delete intake item' : `Delete ${items.length} intake items`}
      onClose={onClose}
      onConfirm={remove}
    >
      <p>
        This removes {items.length === 1 ? 'the item' : `all ${items.length} items`} from the queue
        for good. Nothing else in the product points at an intake item, so nothing else changes.
      </p>
      <ConfirmDeleteList>
        {items.slice(0, NAMED_LIMIT).map((i) => (
          <li key={i.id}>
            <span className="fo-confirm-name">{i.full_name ?? 'Unnamed item'}</span>
            <span className="text-secondary"> {STATUS_LABEL[i.status]}</span>
          </li>
        ))}
        {items.length > NAMED_LIMIT && (
          <li className="text-secondary">and {items.length - NAMED_LIMIT} more</li>
        )}
      </ConfirmDeleteList>
      {imported.length > 0 && (
        <p className="text-secondary">
          {imported.length === 1
            ? 'One of these has already been imported.'
            : `${imported.length} of these have already been imported.`}{' '}
          The candidate or contact it created stays; only the queue entry goes.
        </p>
      )}
      <p className="text-secondary">
        Your role decides which of these can go. Anything it does not cover is left in place and
        counted back to you.
      </p>
    </ConfirmDeleteDialog>
  );
}
