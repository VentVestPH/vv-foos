import { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ConfirmDeleteDialog } from '../../components/ui/ConfirmDeleteDialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { FoDialog } from '../../components/ui/FoDialog';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../auth/SessionProvider';
import type { Tables } from '../../lib/database.types';
import { TEMPLATE_PLACEHOLDERS, unknownPlaceholders } from '../../lib/emailTemplates';

type EmailTemplate = Tables<'email_templates'>;
type Draft = { id: string; name: string; subject: string; body: string };

const EMPTY: Draft = { id: '', name: '', subject: '', body: '' };

function TemplateDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const unknown = [...unknownPlaceholders(draft.subject), ...unknownPlaceholders(draft.body)];
  const missing = !draft.name.trim()
    ? 'Give the template a name'
    : !draft.subject.trim()
      ? 'Give the template a subject'
      : !draft.body.trim()
        ? 'Write the message body'
        : null;

  const insertPlaceholder = (placeholder: string) => {
    const token = `{{${placeholder}}}`;
    const area = bodyRef.current;
    const start = area?.selectionStart ?? draft.body.length;
    const end = area?.selectionEnd ?? draft.body.length;
    const body = `${draft.body.slice(0, start)}${token}${draft.body.slice(end)}`;
    setDraft({ ...draft, body });
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = { name: draft.name.trim(), subject: draft.subject.trim(), body: draft.body.trim() };
    const { error: err } = draft.id
      ? await supabase.from('email_templates').update(payload).eq('id', draft.id)
      : await supabase.from('email_templates').insert(payload);
    setBusy(false);
    if (err) {
      setError(err.code === '23505' ? `A template called “${payload.name}” already exists.` : err.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <FoDialog
      title={draft.id ? 'Edit template' : 'New template'}
      onClose={onClose}
      wide
      footer={(close) => (
        <>
          <Button onClick={close} disabled={busy}>Cancel</Button>
          <Button variant="primary" disabled={busy || missing !== null} title={busy ? 'Saving' : missing ?? undefined} onClick={() => void save()}>
            {draft.id ? 'Save changes' : 'Add template'}
          </Button>
        </>
      )}
    >
      <div className="template-form">
        <Input label="Template name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Screening call invite" />
        <Input label="Subject" required value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Screening call, {{first_name}}" />
        <div className="field">
          <label className="field-label" htmlFor="template-body">
            Message<span className="field-required"> *</span>
          </label>
          <textarea
            id="template-body"
            ref={bodyRef}
            className="input"
            rows={8}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </div>
        <div className="template-placeholders">
          <span>Insert a merge field:</span>
          {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
            <button key={placeholder} type="button" className="template-chip" onClick={() => insertPlaceholder(placeholder)}>
              {`{{${placeholder}}}`}
            </button>
          ))}
        </div>
        {unknown.length > 0 && (
          <span className="field-error-text" role="alert">
            Unknown placeholder{unknown.length === 1 ? '' : 's'}: {unknown.join(', ')}. It will be sent as written.
          </span>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </FoDialog>
  );
}

export function EmailTemplatesCard() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'recruiter';
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('email_templates').select('*').order('name');
    if (err) setError(err.message);
    else setTemplates(data ?? []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="settings-card settings-templates" aria-label="Email templates">
      <div className="settings-card-head">
        <p className="text-secondary">
          {loaded ? `${templates.length} ${templates.length === 1 ? 'template' : 'templates'}. ` : ''}
          Merge fields are filled in for each recipient when the email is sent.
        </p>
        {canEdit && (
          <Button variant="primary" onClick={() => setEditing(EMPTY)}>
            <Plus size={20} aria-hidden="true" />
            New template
          </Button>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {loaded && templates.length === 0 ? (
        <EmptyState
          compact
          icon={<Mail size={32} />}
          title="No templates yet"
          hint={canEdit ? 'Create one with New template, then pick it from Send Email on any candidate.' : 'An admin or recruiter can add templates here.'}
        />
      ) : (
        <ul className="template-grid">
          {templates.map((t) => (
            <li key={t.id} className="template-tile">
              <div className="template-tile-body">
                <strong>{t.name}</strong>
                <span className="template-subject">{t.subject}</span>
                <p className="template-preview">{t.body}</p>
              </div>
              {canEdit && (
                <div className="template-tile-actions">
                  <button
                    type="button"
                    className="fo-icon-btn"
                    aria-label={`Edit ${t.name}`}
                    title="Edit template"
                    onClick={() => setEditing({ id: t.id, name: t.name, subject: t.subject, body: t.body })}
                  >
                    <Pencil size={20} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="fo-icon-btn"
                    aria-label={`Delete ${t.name}`}
                    title="Delete template"
                    onClick={() => setDeleting(t)}
                  >
                    <Trash2 size={20} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && <TemplateDialog initial={editing} onClose={() => setEditing(null)} onSaved={() => void load()} />}
      {deleting && (
        <ConfirmDeleteDialog
          title="Delete template?"
          confirmLabel="Delete template"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const { error: err } = await supabase.from('email_templates').delete().eq('id', deleting.id);
            if (err) throw new Error(err.message);
            setDeleting(null);
            await load();
          }}
        >
          <p>“{deleting.name}” will no longer be offered in Send Email. Emails already sent are not affected.</p>
        </ConfirmDeleteDialog>
      )}
    </section>
  );
}
