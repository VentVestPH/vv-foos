import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { supabase } from '../lib/supabase';

type Mode = 'event' | 'task' | 'interview';

const TITLES: Record<Mode, string> = {
  event: 'New event',
  task: 'New task',
  interview: 'Schedule interview',
};

interface NewCalendarEntryDialogProps {
  mode: Mode;
  staffId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function localNow(offsetMinutes: number): string {
  const at = new Date(Date.now() + offsetMinutes * 60000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function todayIso(): string {
  const at = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

export function NewCalendarEntryDialog({
  mode,
  staffId,
  onClose,
  onSaved,
}: NewCalendarEntryDialogProps) {
  const [subject, setSubject] = useState('');
  const [when, setWhen] = useState(() => (mode === 'task' ? todayIso() : localNow(60)));
  const [personId, setPersonId] = useState('');
  const [people, setPeople] = useState<{ value: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'interview') return;
    let cancelled = false;
    void supabase
      .from('candidate_list')
      .select('person_id, full_name')
      .order('full_name')
      .limit(50)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          return;
        }
        setPeople(
          (data ?? []).map((r) => ({
            value: r.person_id as string,
            label: (r.full_name as string) ?? 'Unnamed',
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const save = async () => {
    if (!subject.trim()) {
      setError('Give it a subject.');
      return;
    }
    if (!staffId) {
      setError('No staff record for this account.');
      return;
    }
    setBusy(true);
    setError(null);

    if (mode === 'task') {
      const { error: err } = await supabase.from('tasks').insert({
        subject: subject.trim(),
        due_date: when || null,
        assignee_id: staffId,
        status: 'open',
      });
      setBusy(false);
      if (err) {
        setError(err.message);
        return;
      }
      onSaved();
      return;
    }

    const occurredAt = new Date(when);
    if (Number.isNaN(occurredAt.getTime())) {
      setBusy(false);
      setError('Pick a date and time.');
      return;
    }

    const { error: err } = await supabase.from('activities').insert({
      kind: 'meeting',
      subject: subject.trim(),
      occurred_at: occurredAt.toISOString(),
      created_by: staffId,
      ...(mode === 'interview' && personId ? { person_id: personId } : {}),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    onSaved();
  };

  return (
    <Dialog
      title={TITLES[mode]}
      onClose={onClose}
      overlayClass="fo-dialog-overlay"
      panelClass="fo-dialog-panel"
      headClass="fo-dialog-head"
      bodyClass="fo-dialog-body"
      footClass="fo-dialog-foot"
      closeClass="fo-dialog-x"
      closeLabel="Close dialog"
      footer={(dismiss) => (
        <>
          <Button size="sm" variant="secondary" onClick={dismiss}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={busy} onClick={() => void save()}>
            {mode === 'task' ? 'Add task' : 'Save event'}
          </Button>
        </>
      )}
    >
      <Input
        label="Subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
      />
      {mode === 'task' ? (
        <Input
          label="Due date"
          type="date"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      ) : (
        <Input
          label="When"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
        />
      )}
      {mode === 'interview' && (
        <Select
          label="Candidate"
          value={personId}
          placeholder={people.length ? 'Pick a candidate' : 'No candidates you can see'}
          options={people}
          onChange={(e) => setPersonId(e.target.value)}
        />
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
