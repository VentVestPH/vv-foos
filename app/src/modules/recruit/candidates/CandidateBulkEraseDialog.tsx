import { useState } from 'react';
import { ConfirmDeleteDialog, ConfirmDeleteList } from '../../../components/ui/ConfirmDeleteDialog';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';

const NAMED_LIMIT = 8;

interface CandidateBulkEraseTarget {
  id: string;
  name: string;
}

export interface CandidateBulkEraseDialogProps {
  targets: CandidateBulkEraseTarget[];
  onClose: () => void;
  onErased: (count: number) => void;
}

export function CandidateBulkEraseDialog({
  targets,
  onClose,
  onErased,
}: CandidateBulkEraseDialogProps) {
  const [reason, setReason] = useState('');

  const erase = async () => {
    const trimmed = reason.trim();
    if (!trimmed) throw new Error('A reason is required, and it is kept on the erasure receipt.');
    for (const target of targets) {
      const { error } = await supabase.rpc('fn_erase_person', {
        p_person: target.id,
        p_reason: trimmed,
      });
      if (error) throw new Error(`${target.name}: ${error.message}`);
    }
    onErased(targets.length);
  };

  return (
    <ConfirmDeleteDialog
      wide
      title={
        targets.length === 1 ? 'Delete candidate' : `Delete ${targets.length} candidates`
      }
      confirmLabel={
        targets.length === 1 ? 'Delete permanently' : `Delete ${targets.length} permanently`
      }
      onClose={onClose}
      onConfirm={erase}
    >
      <p>
        This erases {targets.length === 1 ? 'this person' : 'these people'} and every application,
        activity, task, reminder and file attached to them. It cannot be undone.
      </p>
      <ConfirmDeleteList>
        {targets.slice(0, NAMED_LIMIT).map((t) => (
          <li key={t.id}>
            <span className="fo-confirm-name">{t.name}</span>
          </li>
        ))}
        {targets.length > NAMED_LIMIT && (
          <li className="text-secondary">and {targets.length - NAMED_LIMIT} more</li>
        )}
      </ConfirmDeleteList>
      <Input
        label="Reason"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why these records are being erased"
      />
      <p className="text-secondary">
        A receipt is kept recording who erased whom and when, with counts but no personal data.
        Erasing is not the same as marking someone do-not-contact, which keeps the record and stops
        the outreach.
      </p>
    </ConfirmDeleteDialog>
  );
}
