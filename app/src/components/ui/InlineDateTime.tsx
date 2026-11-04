import { useState } from 'react';
import { PencilLine } from 'lucide-react';
import { Button } from './Button';
import { DateField } from './DateField';
import { errMsg } from '../../lib/errMsg';
import { joinLocal, splitLocal } from '../../lib/localDateTime';

interface InlineDateTimeProps {
  label: string;
  value: string;
  display: string;
  editable: boolean;
  onCommit: (iso: string) => Promise<void>;
}

export function InlineDateTime({ label, value, display, editable, onCommit }: InlineDateTimeProps) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!editable) return <span className="text-secondary">{display}</span>;

  if (!editing) {
    return (
      <span className="fo-inline-view">
        <span className="text-secondary">{display}</span>
        <button
          type="button"
          className="fo-inline-edit"
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          onClick={() => {
            const parts = splitLocal(value);
            setDate(parts.date);
            setTime(parts.time);
            setError(null);
            setEditing(true);
          }}
        >
          <PencilLine size={20} aria-hidden="true" />
        </button>
      </span>
    );
  }

  const save = async () => {
    const iso = joinLocal(date, time);
    if (iso === null) {
      setError('Enter a date and a time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (iso !== new Date(value).toISOString()) await onCommit(iso);
      setEditing(false);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span
      className="fo-inline-datetime"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) setEditing(false);
      }}
    >
      <DateField aria-label={`${label} date`} value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} />
      <input
        type="time"
        className="input fo-inline-time"
        aria-label={`${label} time`}
        value={time}
        disabled={busy}
        onChange={(e) => setTime(e.target.value)}
      />
      <Button size="sm" variant="primary" disabled={busy} onClick={() => void save()}>
        Save
      </Button>
      <Button size="sm" disabled={busy} onClick={() => setEditing(false)}>
        Cancel
      </Button>
      {error && (
        <span className="field-error-text" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
