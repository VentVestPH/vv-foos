import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';
import { Dialog } from '../components/Dialog';
import { type Person, errMsg, personName } from '../lib';

export interface CandidateEraseDialogProps {
  person: Person;
  onClose: () => void;
  onErased: () => void;
}

export function CandidateEraseDialog({ person, onClose, onErased }: CandidateEraseDialogProps) {
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = personName(person);
  const ready = confirmation.trim().toLowerCase() === name.toLowerCase() && reason.trim().length > 0;

  const erase = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.rpc('fn_erase_person', {
        p_person: person.id,
        p_reason: reason.trim(),
      });
      if (err) throw new Error(err.message);
      onErased();
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="Erase this candidate"
      onClose={onClose}
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="danger" disabled={!ready || busy} onClick={() => void erase()}>
            {busy ? 'Erasing…' : 'Erase permanently'}
          </Button>
        </>
      )}
    >
      <p>
        This deletes {name} and every application, activity, task, reminder and file attached to
        them. It cannot be undone, and it is not the same as marking them do-not-contact.
      </p>
      <p className="text-secondary">
        A receipt is kept recording who erased whom and when, with counts but no personal data, so
        the erasure itself stays auditable. Files are queued for the Storage sweep, which finishes
        the job.
      </p>
      <Input
        label="Why (recorded on the receipt)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      <Input
        label={`Type the candidate's name to confirm: ${name}`}
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
      />
      {error && <span className="field-error-text">{error}</span>}
    </Dialog>
  );
}
