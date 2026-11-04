import { Fragment, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDeleteDialog } from '../../../components/ui/ConfirmDeleteDialog';
import { InfoGroup } from '../../../components/ui/InfoGroup';
import { InlineField } from '../../../components/ui/InlineField';
import { errMsg } from '../../../lib/errMsg';
import type { Json } from '../../../lib/database.types';

type Entry = Record<string, Json | undefined>;

interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'textarea';
}

const EDUCATION_FIELDS: FieldSpec[] = [
  { key: 'bachelor_discipline', label: 'Bachelor Discipline', kind: 'text' },
  { key: 'university', label: 'University', kind: 'text' },
  { key: 'year', label: 'Year', kind: 'text' },
  { key: 'higher_degrees', label: 'Higher Degrees', kind: 'text' },
  { key: 'other_degrees', label: 'Other Degrees', kind: 'text' },
];

const EXPERIENCE_FIELDS: FieldSpec[] = [
  { key: 'title', label: 'Title', kind: 'text' },
  { key: 'employer', label: 'Employer', kind: 'text' },
  { key: 'start_date', label: 'Start Date', kind: 'text' },
  { key: 'end_date', label: 'End Date', kind: 'text' },
  { key: 'description', label: 'Description', kind: 'textarea' },
];

function labelFor(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function textOf(entry: Entry, key: string): string {
  const v = entry[key];
  if (v === null || v === undefined) return '';
  return typeof v === 'string' ? v : String(v);
}

function fieldsFor(base: FieldSpec[], entry: Entry): FieldSpec[] {
  const known = new Set(base.map((f) => f.key));
  const extra = Object.keys(entry)
    .filter((k) => !known.has(k) && textOf(entry, k) !== '')
    .map((k): FieldSpec => ({ key: k, label: labelFor(k), kind: 'text' }));
  return [...base, ...extra];
}

interface HistoryGroupProps {
  title: string;
  noun: string;
  fields: FieldSpec[];
  entries: Entry[];
  editable: boolean;
  emptyHint?: string;
  onSave: (next: Entry[]) => Promise<void>;
}

function HistoryGroup({
  title,
  noun,
  fields,
  entries,
  editable,
  emptyHint,
  onSave,
}: HistoryGroupProps) {
  const [removing, setRemoving] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!editable && entries.length === 0) {
    if (emptyHint === undefined) return null;
    return (
      <InfoGroup label={title}>
        <p className="info-group-hint">{emptyHint}</p>
      </InfoGroup>
    );
  }

  const commit = (index: number, key: string, next: string) =>
    onSave(
      entries.map((entry, i) => {
        if (i !== index) return entry;
        const copy: Entry = { ...entry };
        if (next === '') delete copy[key];
        else copy[key] = next;
        return copy;
      }),
    );

  const add = async () => {
    setAdding(true);
    setAddError(null);
    try {
      await onSave([...entries, {}]);
    } catch (e) {
      setAddError(errMsg(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <InfoGroup label={title}>
      {entries.length === 0 && emptyHint !== undefined && (
        <p className="info-group-hint">{emptyHint}</p>
      )}
      {entries.map((entry, i) => {
        const shown = editable
          ? fieldsFor(fields, entry)
          : fieldsFor(fields, entry).filter((f) => textOf(entry, f.key) !== '');
        return (
          <Fragment key={`${noun}-${i}`}>
            {(entries.length > 1 || editable) && (
              <div className="fo-entry-head">
                <span className="fo-entry-title">
                  {noun} {i + 1}
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${noun.toLowerCase()} ${i + 1}`}
                    onClick={() => setRemoving(i)}
                  >
                    <Trash2 size={20} aria-hidden="true" />
                    Remove
                  </Button>
                )}
              </div>
            )}
            <dl className="info-grid">
              {shown.map((f) => (
                <div className="info-item" key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>
                    <InlineField
                      label={`${f.label} (${noun.toLowerCase()} ${i + 1})`}
                      kind={f.kind}
                      value={textOf(entry, f.key)}
                      editable={editable}
                      onCommit={(next) => commit(i, f.key, next)}
                    />
                  </dd>
                </div>
              ))}
            </dl>
          </Fragment>
        );
      })}
      {editable && (
        <div className="fo-entry-add">
          <Button size="sm" loading={adding} onClick={() => void add()}>
            <Plus size={20} aria-hidden="true" />
            Add {noun.toLowerCase()}
          </Button>
          {addError !== null && (
            <span className="field-error-text" role="alert">
              {addError}
            </span>
          )}
        </div>
      )}
      {removing !== null && (
        <ConfirmDeleteDialog
          title={`Remove ${noun.toLowerCase()} ${removing + 1}?`}
          confirmLabel="Remove"
          busyLabel="Removing…"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await onSave(entries.filter((_, i) => i !== removing));
            setRemoving(null);
          }}
        >
          <p>This removes the entry from the candidate record.</p>
        </ConfirmDeleteDialog>
      )}
    </InfoGroup>
  );
}

interface CandidateHistoryGroupsProps {
  education: Entry[];
  experience: Entry[];
  editable: boolean;
  onSaveEducation: (next: Entry[]) => Promise<void>;
  onSaveExperience: (next: Entry[]) => Promise<void>;
}

export function CandidateHistoryGroups({
  education,
  experience,
  editable,
  onSaveEducation,
  onSaveExperience,
}: CandidateHistoryGroupsProps) {
  return (
    <>
      <HistoryGroup
        title="Education"
        noun="Education"
        fields={EDUCATION_FIELDS}
        entries={education}
        editable={editable}
        onSave={onSaveEducation}
      />
      <HistoryGroup
        title="Experience"
        noun="Experience"
        fields={EXPERIENCE_FIELDS}
        entries={experience}
        editable={editable}
        emptyHint="No employment history on file yet."
        onSave={onSaveExperience}
      />
    </>
  );
}
