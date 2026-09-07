import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Modal } from './Modal';

interface LostReasonDialogProps {
  dealLabel: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function LostReasonDialog({
  dealLabel,
  onConfirm,
  onCancel,
}: LostReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A lost reason is required before the deal can move to lost.');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <Modal title="Mark deal as lost">
      <p style={{ margin: 0 }}>
        {dealLabel} is moving to <strong>lost</strong>. Record why — the
        reason is required.
      </p>
      <textarea
        className="sales-textarea"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          if (error) setError(null);
        }}
        placeholder="Lost reason (required)"
        aria-label="Lost reason"
        autoFocus
      />
      {error && <span className="field-error-text" role="alert">{error}</span>}
      <div className="sales-modal-actions">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={submit}>
          Mark lost
        </Button>
      </div>
    </Modal>
  );
}
