import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useRole } from '../../auth/SessionProvider';
import type { Tables } from '../../lib/database.types';
import { TEMPLATE_PLACEHOLDERS, unknownPlaceholders } from '../../lib/emailTemplates';

type EmailTemplate = Tables<'email_templates'>;

const EMPTY = { id: '', name: '', subject: '', body: '' };

export function EmailTemplatesCard() {
  const role = useRole();
  const canEdit = role === 'admin' || role === 'recruiter';
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('email_templates')
      .select('*')
      .order('name');
    if (err) setError(err.message);
    else setTemplates(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unknown = [...unknownPlaceholders(draft.subject), ...unknownPlaceholders(draft.body)];

  const save = async () => {
    setBusy(true);
    setError(null);
    const payload = {
      name: draft.name.trim(),
      subject: draft.subject.trim(),
      body: draft.body.trim(),
    };
    const { error: err } = draft.id
      ? await supabase.from('email_templates').update(payload).eq('id', draft.id)
      : await supabase.from('email_templates').insert(payload);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDraft(EMPTY);
    await load();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('email_templates').delete().eq('id', id);
    if (err) setError(err.message);
    else await load();
  };

  return (
    <section className="settings-card">
      <h2>Email templates</h2>
      <p className="text-secondary">
        Reusable subject and message text for candidate outreach. Placeholders are filled in per
        recipient when the email is sent: {TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(', ')}.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <ul className="template-list">
        {templates.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <span className="text-secondary">{t.subject}</span>
            </div>
            {canEdit && (
              <div className="template-list-actions">
                <Button
                  size="sm"
                  onClick={() =>
                    setDraft({ id: t.id, name: t.name, subject: t.subject, body: t.body })
                  }
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(t.id)}>
                  Delete
                </Button>
              </div>
            )}
          </li>
        ))}
        {templates.length === 0 && <li className="text-secondary">No templates yet.</li>}
      </ul>

      {canEdit && (
        <div className="template-form">
          <Input
            label="Template name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            label="Subject"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
          <div className="field">
            <label className="field-label" htmlFor="template-body">
              Message
            </label>
            <textarea
              id="template-body"
              rows={6}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </div>
          {unknown.length > 0 && (
            <span className="field-error-text" role="alert">
              Unknown placeholder{unknown.length === 1 ? '' : 's'}: {unknown.join(', ')}. It will be
              sent as written.
            </span>
          )}
          <div className="template-form-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={busy || !draft.name.trim() || !draft.subject.trim() || !draft.body.trim()}
              onClick={() => void save()}
            >
              {draft.id ? 'Save changes' : 'Add template'}
            </Button>
            {draft.id && (
              <Button size="sm" onClick={() => setDraft(EMPTY)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
