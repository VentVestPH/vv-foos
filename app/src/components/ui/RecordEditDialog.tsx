import { useMemo, useState, type ReactNode } from 'react';
import { FormSections, type FormSection } from './FormSections';
import { Button } from './Button';
import { DateField } from './DateField';
import { FoDialog } from './FoDialog';
import { Input } from './Input';
import { Select } from './Select';
import { errMsg } from '../../lib/errMsg';

export type EditValue = string | boolean | string[];

interface FieldBase {
  key: string;
  label: string;
  span?: boolean;
  section?: string;
}

export type EditField =
  | (FieldBase & { kind: 'text' | 'email' | 'url' | 'number'; placeholder?: string })
  | (FieldBase & { kind: 'date' })
  | (FieldBase & { kind: 'textarea'; placeholder?: string })
  | (FieldBase & { kind: 'select'; options: { value: string; label: string }[]; placeholder?: string })
  | (FieldBase & { kind: 'checkbox' })
  | (FieldBase & { kind: 'checkgroup'; options: string[] });

interface RecordEditDialogProps {
  title: string;
  fields: EditField[];
  values: Record<string, EditValue>;
  required?: string[];
  footNote?: ReactNode;
  onClose: () => void;
  onSave: (values: Record<string, EditValue>) => Promise<void>;
}

function asText(value: EditValue | undefined): string {
  return typeof value === 'string' ? value : '';
}

export function RecordEditDialog({
  title,
  fields,
  values,
  required = [],
  footNote,
  onClose,
  onSave,
}: RecordEditDialogProps) {
  const [draft, setDraft] = useState<Record<string, EditValue>>(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: EditValue) => setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    const missing = required.filter((key) => asText(draft[key]).trim() === '');
    if (missing.length > 0) {
      const names = missing
        .map((key) => fields.find((f) => f.key === key)?.label ?? key)
        .join(', ');
      setError(`${names} cannot be empty.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  };

  const groups = useMemo(() => {
    const out: { name: string | null; items: EditField[] }[] = [];
    for (const field of fields) {
      const name = field.section ?? null;
      const last = out[out.length - 1];
      if (last && last.name === name) last.items.push(field);
      else out.push({ name, items: [field] });
    }
    return out;
  }, [fields]);


  const ungrouped = groups.find((g) => g.name === null)?.items ?? [];

  const renderField = (field: EditField) => {
    const wide = field.span || field.kind === 'textarea' || field.kind === 'checkgroup';
    const cell = wide ? 'fo-form-span' : undefined;

    if (field.kind === 'checkbox') {
      return (
        <label key={field.key} className={cell ? `checkline ${cell}` : 'checkline'}>
          <input
            type="checkbox"
            checked={draft[field.key] === true}
            onChange={(e) => set(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      );
    }

    if (field.kind === 'checkgroup') {
      const chosen = Array.isArray(draft[field.key]) ? (draft[field.key] as string[]) : [];
      return (
        <div key={field.key} className={cell ? `field ${cell}` : 'field'}>
          <span className="field-label">{field.label}</span>
          <div className="fo-checkgroup">
            {field.options.map((option) => (
              <label key={option} className="checkline">
                <input
                  type="checkbox"
                  checked={chosen.includes(option)}
                  onChange={() =>
                    set(
                      field.key,
                      chosen.includes(option)
                        ? chosen.filter((v) => v !== option)
                        : [...chosen, option],
                    )
                  }
                />
                {option}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (field.kind === 'textarea') {
      return (
        <div key={field.key} className={cell ? `field ${cell}` : 'field'}>
          <label className="field-label" htmlFor={`edit-${field.key}`}>
            {field.label}
          </label>
          <textarea
            id={`edit-${field.key}`}
            className="input"
            value={asText(draft[field.key])}
            placeholder={field.placeholder}
            onChange={(e) => set(field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.kind === 'select') {
      return (
        <div key={field.key} className={cell}>
          <Select
            label={field.label}
            options={field.options}
            placeholder={field.placeholder ?? 'Not set'}
            value={asText(draft[field.key])}
            onChange={(e) => set(field.key, e.target.value)}
          />
        </div>
      );
    }

    if (field.kind === 'date') {
      return (
        <div key={field.key} className={cell}>
          <DateField
            label={field.label}
            value={asText(draft[field.key])}
            onChange={(e) => set(field.key, e.target.value)}
          />
        </div>
      );
    }

    return (
      <div key={field.key} className={cell}>
        <Input
          label={field.label}
          type={field.kind === 'number' ? 'number' : field.kind}
          value={asText(draft[field.key])}
          placeholder={field.placeholder}
          required={required.includes(field.key)}
          onChange={(e) => set(field.key, e.target.value)}
        />
      </div>
    );
  };

  const accordionSections: FormSection[] = groups
    .filter((g) => g.name !== null)
    .map((g) => ({
      name: g.name as string,
      content: <div className="fo-form-grid">{g.items.map(renderField)}</div>,
    }));

  return (
    <FoDialog
      className="fo-form-dialog fo-dialog-panel-form"
      title={title}
      onClose={onClose}
      footer={(close) => (
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving\u2026' : 'Save'}
          </Button>
        </>
      )}
    >
      {ungrouped.length > 0 && (
        <div className="fo-form-grid">{ungrouped.map(renderField)}</div>
      )}
      <FormSections sections={accordionSections} />
      {footNote && <p className="text-secondary">{footNote}</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </FoDialog>
  );
}
