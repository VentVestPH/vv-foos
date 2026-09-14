import { ConfirmDeleteDialog } from '../../../components/ui/ConfirmDeleteDialog';
import { supabase } from '../../../lib/supabase';

export interface DealDeleteDialogProps {
  dealId: string;
  displayCode: string;
  name: string;
  activityCount: number;
  onClose: () => void;
  onDeleted: () => void;
}

export function DealDeleteDialog({
  dealId,
  displayCode,
  name,
  activityCount,
  onClose,
  onDeleted,
}: DealDeleteDialogProps) {
  const remove = async () => {
    const { error } = await supabase.from('deals').delete().eq('id', dealId);
    if (error) throw new Error(error.message);
    onDeleted();
  };

  return (
    <ConfirmDeleteDialog title="Delete deal" onClose={onClose} onConfirm={remove}>
      <p>
        This deletes <strong>{displayCode}</strong> {name} for good.
      </p>
      {activityCount > 0 && (
        <p className="text-secondary">
          {activityCount === 1
            ? 'The one activity logged against it goes too.'
            : `The ${activityCount} activities logged against it go too.`}{' '}
          Notes and calls filed against the account or a contact are not affected.
        </p>
      )}
      <p className="text-secondary">
        A deal that was lost is better marked lost than deleted: the stage keeps it out of the
        pipeline while leaving the history to report on. Delete is for a deal that should never
        have existed.
      </p>
    </ConfirmDeleteDialog>
  );
}
