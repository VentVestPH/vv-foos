import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { PencilLine } from 'lucide-react';
import { DateField } from './DateField';
import { Input } from './Input';
import { Select } from './Select';
import type { EditField, EditValue } from './RecordEditDialog';
import { errMsg } from '../../lib/errMsg';
import { EMPTY_CELL } from '../../lib/format';

type InlineKind = 'text' | 'email' | 'url' | 'number' | 'textarea' | 'date' | 'select';

export interface InlineFieldProps {
  label: string;
  kind: InlineKind;
  value: string;
  display?: ReactNode;
  options?: { value: string; label: string }[] | undefined;
  placeholder?: string | undefined;
  editable: boolean;
  required?: boolean;
  onCommit: (next: string) => Promise<void>;
}

export function InlineField({
  label,
  kind,
  value,
  display,
  options,
  placeholder,
  editable,
  required = false,
  onCommit,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const finished = useRef(false);
  const inFlight = useRef(false);
  const errorId = useId();

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    const el = kind === 'textarea' ? areaRef.current : inputRef.current;
    el?.focus();
    el?.select();
  }, [editing, kind]);

  const run = async (next: string): Promise<boolean> => {
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await onCommit(next);
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const begin = () => {
    finished.current = false;
    setError(null);
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    finished.current = true;
    setError(null);
    setDraft(value);
    setEditing(false);
  };

  const commitDraft = async () => {
    if (finished.current || inFlight.current) return;
    const next = draft.trim();
    if (next === value.trim()) {
      finished.current = true;
      setError(null);
      setEditing(false);
      return;
    }
    if (required && next === '') {
      setError(`${label} cannot be empty.`);
      return;
    }
    const ok = await run(next);
    if (ok) {
      finished.current = true;
      setEditing(false);
    }
  };

  const commitDirect = async (next: string) => {
    if (inFlight.current || next === value) return;
    await run(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
      return;
    }
    if (event.key !== 'Enter') return;
    if (kind === 'textarea' && !(event.metaKey || event.ctrlKey)) return;
    event.preventDefault();
    void commitDraft();
  };

  const errorNode =
    error === null ? null : (
      <span className="field-error-text" role="alert" id={errorId}>
        {error}
      </span>
    );

  const shown = display ?? (value === '' ? EMPTY_CELL : value);

  if (!editable) return <span className="fo-inline-value">{shown}</span>;

  if (kind === 'select') {
    return (
      <div className="fo-inline">
        <Select
          aria-label={label}
          options={options ?? []}
          placeholder={placeholder ?? 'Not set'}
          value={value}
          disabled={busy}
          onChange={(e) => void commitDirect(e.target.value)}
        />
        {errorNode}
      </div>
    );
  }

  if (kind === 'date') {
    return (
      <div className="fo-inline">
        <DateField
          aria-label={label}
          value={value}
          disabled={busy}
          onChange={(e) => void commitDirect(e.target.value)}
        />
        {errorNode}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="fo-inline">
        <div className="fo-inline-view">
          {display === undefined ? (
            <button
              type="button"
              className="fo-inline-trigger"
              title={`Edit ${label}`}
              onClick={begin}
            >
              <span className="fo-inline-value">{shown}</span>
            </button>
          ) : (
            <>
              <span className="fo-inline-value">{shown}</span>
              <button
                type="button"
                className="fo-inline-edit"
                aria-label={`Edit ${label}`}
                title={`Edit ${label}`}
                onClick={begin}
              >
                <PencilLine size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {errorNode}
      </div>
    );
  }

  return (
    <div className="fo-inline">
      {kind === 'textarea' ? (
        <textarea
          ref={areaRef}
          className="input fo-inline-input"
          aria-label={label}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commitDraft()}
        />
      ) : (
        <Input
          ref={inputRef}
          className="input fo-inline-input"
          type={kind}
          aria-label={label}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
          value={draft}
          placeholder={placeholder}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => void commitDraft()}
        />
      )}
      {errorNode}
    </div>
  );
}

export interface InlineRecordFieldProps {
  field: EditField;
  values: Record<string, EditValue>;
  editable: boolean;
  label?: string;
  display?: ReactNode;
  required?: boolean;
  onSave: (draft: Record<string, EditValue>) => Promise<void>;
}

export function InlineRecordField({
  field,
  values,
  editable,
  label,
  display,
  required,
  onSave,
}: InlineRecordFieldProps) {
  const current = values[field.key];
  const text = typeof current === 'string' ? current : '';

  if (field.kind === 'checkbox' || field.kind === 'checkgroup') {
    return <span className="fo-inline-value">{display ?? (text === '' ? EMPTY_CELL : text)}</span>;
  }

  return (
    <InlineField
      label={label ?? field.label}
      kind={field.kind}
      value={text}
      {...(display === undefined ? {} : { display })}
      options={field.kind === 'select' ? field.options : undefined}
      placeholder={field.kind === 'date' ? undefined : field.placeholder}
      editable={editable}
      {...(required === undefined ? {} : { required })}
      onCommit={(next) => onSave({ ...values, [field.key]: next })}
    />
  );
}
