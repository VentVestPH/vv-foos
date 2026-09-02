import { useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useEmailTemplates } from '../../../hooks/useEmailTemplates';
import { applyTemplate } from '../../../lib/emailTemplates';
import { supabase } from '../../../lib/supabase';
import { sendEmail } from '../../../lib/googleActions';
import { Dialog } from '../components/Dialog';
import type { CandidateProfile, CandidateStatus, Person } from '../lib';
import { personEmails, personName } from '../lib';

type Pending = 'status' | 'flag-on' | 'flag-off' | 'email' | null;

export interface CandidateBulkActionsProps {
  selected: Set<string>;
  profiles: CandidateProfile[];
  people: Map<string, Person>;
  statuses: CandidateStatus[];
  canEdit: boolean;
  onDone: () => Promise<void>;
  onClear: () => void;
}

interface Recipient {
  personId: string;
  name: string;
  email: string | null;
  doNotContact: boolean;
  firstName: string;
  lastName: string;
}

export function CandidateBulkActions({
  selected,
  profiles,
  people,
  statuses,
  canEdit,
  onDone,
  onClear,
}: CandidateBulkActionsProps) {
  const [pending, setPending] = useState<Pending>(null);
  const [statusId, setStatusId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const templates = useEmailTemplates();

  const ids = useMemo(() => [...selected], [selected]);
  const count = ids.length;

  const recipients = useMemo<Recipient[]>(
    () =>
      ids.map((personId) => {
        const person = people.get(personId);
        const profile = profiles.find((p) => p.person_id === personId);
        return {
          personId,
          name: person ? personName(person) : personId,
          email: person ? (personEmails(person)[0]?.address ?? null) : null,
          doNotContact: profile?.do_not_contact ?? false,
          firstName: person?.first_name ?? '',
          lastName: person?.last_name ?? '',
        };
      }),
    [ids, people, profiles],
  );

  const mailable = recipients.filter((r) => r.email && !r.doNotContact);
  const excluded = recipients.filter((r) => !r.email || r.doNotContact);

  const close = () => {
    setPending(null);
    setError(null);
    setOutcome(null);
    setBusy(false);
  };

  const applyStatus = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('candidate_profiles')
      .update({ status_id: statusId })
      .in('person_id', ids);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    close();
    onClear();
    await onDone();
  };

  const applyFlag = async (value: boolean) => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('candidate_profiles')
      .update({ do_not_contact: value })
      .in('person_id', ids);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    close();
    onClear();
    await onDone();
  };

  const applyEmail = async () => {
    setBusy(true);
    setError(null);
    const failures: string[] = [];
    let sent = 0;
    for (const recipient of mailable) {
      const fields = {
        first_name: recipient.firstName,
        last_name: recipient.lastName,
        full_name: recipient.name,
      };
      const { error: err } = await sendEmail({
        personId: recipient.personId,
        to: recipient.email as string,
        subject: applyTemplate(subject.trim(), fields),
        bodyText: applyTemplate(body.trim(), fields),
      });
      if (err) failures.push(`${recipient.name}: ${err}`);
      else sent += 1;
    }
    setBusy(false);
    if (failures.length) {
      setError(failures.join(' · '));
      setOutcome(`${sent} sent, ${failures.length} failed.`);
      await onDone();
      return;
    }
    close();
    onClear();
    await onDone();
  };

  const statusLabel = statuses.find((s) => s.id === statusId)?.label ?? '';
  const disabled = count === 0 || !canEdit;
  const disabledReason = !canEdit
    ? 'Only an admin or a recruiter can change candidates in bulk'
    : 'Select at least one candidate first';

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        title={disabled ? disabledReason : `Mark ${count} selected`}
        onClick={() => setPending('flag-on')}
      >
        Mark as…
      </Button>
      <Button
        size="sm"
        disabled={disabled}
        title={disabled ? disabledReason : `Change the status of ${count} selected`}
        onClick={() => {
          setStatusId(statuses[0]?.id ?? '');
          setPending('status');
        }}
      >
        Change Main Status to…
      </Button>
      <Button
        size="sm"
        disabled={count === 0}
        title={count === 0 ? 'Select at least one candidate first' : `Email ${count} selected`}
        onClick={() => {
          setSubject('');
          setBody('');
          setPending('email');
        }}
      >
        Send Email
      </Button>

      {pending === 'status' && (
        <Dialog
          title={`Change the main status of ${count} candidate${count === 1 ? '' : 's'}`}
          onClose={close}
          footer={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy || !statusId}
                onClick={() => void applyStatus()}
              >
                {busy ? 'Applying…' : `Set to ${statusLabel || '…'}`}
              </Button>
            </>
          }
        >
          <Select
            label="Main status"
            options={statuses.map((s) => ({ value: s.id, label: s.label }))}
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
          />
          <p className="text-secondary">
            Each candidate keeps their own history: this writes one status change per record, the
            same as editing them one at a time.
          </p>
          <BulkNameList recipients={recipients} />
          {error && <span className="field-error-text">{error}</span>}
        </Dialog>
      )}

      {(pending === 'flag-on' || pending === 'flag-off') && (
        <Dialog
          title={`Mark ${count} candidate${count === 1 ? '' : 's'}`}
          onClose={close}
          footer={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void applyFlag(pending === 'flag-on')}
              >
                {busy
                  ? 'Applying…'
                  : pending === 'flag-on'
                    ? 'Mark do not contact'
                    : 'Clear do not contact'}
              </Button>
            </>
          }
        >
          <div className="field">
            <span className="field-label">Mark as</span>
            <div className="rq-checkbox-list">
              <label className="rq-checkline">
                <input
                  type="radio"
                  name="bulk-flag"
                  checked={pending === 'flag-on'}
                  onChange={() => setPending('flag-on')}
                />
                Do not contact
              </label>
              <label className="rq-checkline">
                <input
                  type="radio"
                  name="bulk-flag"
                  checked={pending === 'flag-off'}
                  onChange={() => setPending('flag-off')}
                />
                Contactable again
              </label>
            </div>
          </div>
          <BulkNameList recipients={recipients} />
          {error && <span className="field-error-text">{error}</span>}
        </Dialog>
      )}

      {pending === 'email' && (
        <Dialog
          title={`Email ${mailable.length} candidate${mailable.length === 1 ? '' : 's'}`}
          onClose={close}
          footer={
            <>
              <Button onClick={close}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy || mailable.length === 0 || !subject.trim() || !body.trim()}
                onClick={() => void applyEmail()}
              >
                {busy ? 'Sending…' : `Send to ${mailable.length}`}
              </Button>
            </>
          }
        >
          {templates.length > 0 && (
            <Select
              label="Template"
              placeholder="Start from scratch"
              options={templates.map((template) => ({
                value: template.id,
                label: template.name,
              }))}
              value=""
              onChange={(e) => {
                const template = templates.find((t) => t.id === e.target.value);
                if (!template) return;
                setSubject(template.subject);
                setBody(template.body);
              }}
            />
          )}
          <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="field">
            <label className="field-label" htmlFor="bulk-email-body">
              Message
            </label>
            <textarea
              id="bulk-email-body"
              className="rq-textarea"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <p className="text-secondary">
            One separate email each, through your own connected Gmail account. Nobody sees another
            recipient, and any placeholder is filled in per person.
          </p>
          <div className="field">
            <span className="field-label">Recipients</span>
            <ul className="bulk-recipient-list">
              {mailable.map((r) => (
                <li key={r.personId}>
                  {r.name} <span className="text-secondary">{r.email}</span>
                </li>
              ))}
            </ul>
          </div>
          {excluded.length > 0 && (
            <div className="field">
              <span className="field-label">Not emailed</span>
              <ul className="bulk-recipient-list">
                {excluded.map((r) => (
                  <li key={r.personId}>
                    {r.name}{' '}
                    <span className="text-secondary">
                      {r.doNotContact ? 'marked do not contact' : 'no email address on file'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome && <p className="text-secondary">{outcome}</p>}
          {error && <span className="field-error-text">{error}</span>}
        </Dialog>
      )}
    </>
  );
}

function BulkNameList({ recipients }: { recipients: Recipient[] }) {
  return (
    <div className="field">
      <span className="field-label">Selected</span>
      <ul className="bulk-recipient-list">
        {recipients.map((r) => (
          <li key={r.personId}>{r.name}</li>
        ))}
      </ul>
    </div>
  );
}
