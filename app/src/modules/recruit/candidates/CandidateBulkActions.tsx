import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/Button';
import { EMPTY_CELL } from '../../../lib/format';
import { ActionMenu, type ActionMenuItem } from '../../../components/ui/ActionMenu';
import { CandidateBulkEraseDialog } from './CandidateBulkEraseDialog';
import { useRole } from '../../../auth/SessionProvider';
import { CandidateBulkSubmitDialog } from './CandidateBulkSubmitDialog';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useEmailTemplates } from '../../../hooks/useEmailTemplates';
import { applyTemplate } from '../../../lib/emailTemplates';
import { supabase } from '../../../lib/supabase';
import { attachmentUrl } from '../components/engagement';
import { isPendingFile } from '../../../lib/attachments';
import { sendEmail } from '../../../lib/googleActions';
import { Dialog } from '../components/Dialog';
import type { CandidateStatus } from '../lib';
import type { CandidateListRow } from './candidateRows';
import { personName } from '../lib';

type Pending = 'status' | 'flag-on' | 'flag-off' | 'email' | null;

const OFF_PAGE_LIMIT = 200;
const RESUME_SCAN_LIMIT = 500;

const BULK_COLUMNS =
  'person_id, first_name, middle_name, last_name, emails, do_not_contact, current_title, current_employer, city, country, status_label, star_grade, grade_comment';

type BulkProfile = Pick<
  CandidateListRow,
  | 'person_id'
  | 'first_name'
  | 'middle_name'
  | 'last_name'
  | 'emails'
  | 'do_not_contact'
  | 'current_title'
  | 'current_employer'
  | 'city'
  | 'country'
  | 'status_label'
  | 'star_grade'
  | 'grade_comment'
>;

export interface CandidateBulkActionsProps {
  selected: Set<string>;
  profiles: CandidateListRow[];
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
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const ids = useMemo(() => [...selected], [selected]);
  const count = ids.length;
  const role = useRole();
  const [erasing, setErasing] = useState(false);

  const [offPage, setOffPage] = useState<Record<string, BulkProfile>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => {
    const missing = ids.filter(
      (id) => !profiles.some((p) => p.person_id === id) && !requested.current.has(id),
    );
    if (missing.length === 0) return undefined;
    for (const id of missing) requested.current.add(id);

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('candidate_list')
        .select(BULK_COLUMNS)
        .in('person_id', missing.slice(0, OFF_PAGE_LIMIT))
        .limit(OFF_PAGE_LIMIT);
      if (cancelled || !data) return;
      setOffPage((prev) => {
        const next = { ...prev };
        for (const row of data) next[row.person_id] = row;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, profiles]);

  const recipients = useMemo<Recipient[]>(
    () =>
      ids.map((personId) => {
        const profile: BulkProfile | undefined =
          profiles.find((p) => p.person_id === personId) ?? offPage[personId];
        const emails = Array.isArray(profile?.emails)
          ? (profile.emails as unknown as { address: string }[])
          : [];
        return {
          personId,
          name: profile ? personName({ ...profile, headline: null }) : 'Loading…',
          email: emails[0]?.address ?? null,
          doNotContact: profile?.do_not_contact ?? false,
          firstName: profile?.first_name ?? '',
          lastName: profile?.last_name ?? '',
        };
      }),
    [ids, profiles, offPage],
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

  const disabled = count === 0 || !canEdit;
  const disabledReason = !canEdit
    ? 'Only an admin or a recruiter can change candidates in bulk'
    : 'Select at least one candidate first';

  useEffect(() => {
    if (!printing) return undefined;
    document.body.dataset.printScope = 'selection';
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done);
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
      delete document.body.dataset.printScope;
    };
  }, [printing]);

  const openResumes = async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from('attachments')
      .select('parent_id, storage_path, uploaded_at')
      .eq('parent_type', 'person')
      .eq('kind', 'resume')
      .in('parent_id', ids)
      .order('uploaded_at', { ascending: false })
      .limit(RESUME_SCAN_LIMIT);
    if (err) {
      setError(err.message);
      return;
    }

    const newest = new Map<string, string>();
    for (const row of data ?? []) {
      if (!newest.has(row.parent_id) && !isPendingFile(row.storage_path)) {
        newest.set(row.parent_id, row.storage_path);
      }
    }
    if (newest.size === 0) {
      setOutcome('None of the selected candidates has a resume on file.');
      return;
    }

    let opened = 0;
    let blocked = 0;
    for (const path of newest.values()) {
      const url = await attachmentUrl(path);
      if (url === null) continue;
      if (window.open(url, '_blank', 'noopener') === null) blocked += 1;
      else opened += 1;
    }

    const without = count - newest.size;
    setOutcome(
      [
        `Opened ${opened} resume${opened === 1 ? '' : 's'}.`,
        without > 0 ? `${without} of the selected has none on file.` : '',
        blocked > 0 ? `${blocked} were blocked by the browser; allow pop-ups for this site.` : '',
      ]
        .filter(Boolean)
        .join(' '),
    );
  };

  const overflowItems: ActionMenuItem[] = [
    {
      label: 'Mark as…',
      onSelect: () => setPending('flag-on'),
      disabled,
      ...(disabled ? { title: disabledReason } : {}),
    },
    {
      label: 'View Resume',
      onSelect: () => void openResumes(),
      disabled: count === 0,
      ...(count === 0 ? { title: 'Select at least one candidate first' } : {}),
    },
    {
      label: 'Print profile',
      onSelect: () => setPrinting(true),
      disabled: count === 0,
      ...(count === 0 ? { title: 'Select at least one candidate first' } : {}),
    },
    {
      label: 'Submit',
      onSelect: () => setSubmitting(true),
      disabled,
      ...(disabled ? { title: disabledReason } : {}),
    },
    ...(role === 'admin'
      ? [
          {
            label: 'Delete permanently…',
            onSelect: () => setErasing(true),
            destructive: true,
            disabled: count === 0,
            title:
              count === 0
                ? 'Select at least one candidate first'
                : `Erase ${count} selected and everything attached to them`,
          },
        ]
      : []),
  ];

  return (
    <>
      <Button
        size="sm"
        disabled={disabled}
        title={disabled ? disabledReason : `Change the status of ${count} selected`}
        onClick={() => {
          setStatusId(statuses[0]?.id ?? '');
          setPending('status');
        }}
      >
        Change status
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
      <ActionMenu label="More actions" items={overflowItems} iconOnly />
      {erasing && (
        <CandidateBulkEraseDialog
          targets={recipients.map((r) => ({ id: r.personId, name: r.name }))}
          onClose={() => setErasing(false)}
          onErased={(n) => {
            setErasing(false);
            setOutcome(`${n} ${n === 1 ? 'candidate' : 'candidates'} deleted.`);
            onDone();
          }}
        />
      )}
      {pending === null && outcome !== null && (
        <span className="text-secondary fo-bulk-outcome">{outcome}</span>
      )}
      {pending === null && error !== null && (
        <span className="field-error-text" role="alert">
          {error}
        </span>
      )}

      {printing &&
        createPortal(
          <section className="cand-print-sheet" aria-hidden="true">
          <h1>Candidate profiles</h1>
          {recipients.map((r) => {
            const profile = profiles.find((p) => p.person_id === r.personId);
            return (
              <article key={r.personId} className="cand-print-card">
                <h2>{r.name}</h2>
                <dl className="info-grid">
                  <div className="info-item">
                    <dt>Title</dt>
                    <dd>{profile?.current_title ?? EMPTY_CELL}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Employer</dt>
                    <dd>{profile?.current_employer ?? EMPTY_CELL}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Location</dt>
                    <dd>
                      {[profile?.city, profile?.country].filter(Boolean).join(', ') || EMPTY_CELL}
                    </dd>
                  </div>
                  <div className="info-item">
                    <dt>Email</dt>
                    <dd>{r.email ?? EMPTY_CELL}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Status</dt>
                    <dd>{profile?.status_label ?? EMPTY_CELL}</dd>
                  </div>
                  <div className="info-item">
                    <dt>Amir Grade</dt>
                    <dd>{profile?.star_grade != null ? `${profile.star_grade} of 3` : EMPTY_CELL}</dd>
                  </div>
                </dl>
                {profile?.grade_comment != null && profile.grade_comment !== '' && (
                  <p className="cand-print-note">{profile.grade_comment}</p>
                )}
              </article>
            );
          })}
          </section>,
          document.body,
        )}

      {submitting && (
        <CandidateBulkSubmitDialog
          personIds={ids}
          onClose={() => setSubmitting(false)}
          onSubmitted={async () => {
            onClear();
            await onDone();
          }}
        />
      )}

      {pending === 'status' && (
        <Dialog
          title="Change status"
          onClose={close}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy || !statusId}
                onClick={() => void applyStatus()}
              >
                {busy ? 'Updating…' : 'Update'}
              </Button>
            </>
          )}
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
          {error && <span className="field-error-text" role="alert">{error}</span>}
        </Dialog>
      )}

      {(pending === 'flag-on' || pending === 'flag-off') && (
        <Dialog
          title="Mark candidates"
          onClose={close}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void applyFlag(pending === 'flag-on')}
              >
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        >
          <div className="field">
            <span className="field-label">Mark as</span>
            <div className="checkbox-list">
              <label className="checkline">
                <input
                  type="radio"
                  name="bulk-flag"
                  checked={pending === 'flag-on'}
                  onChange={() => setPending('flag-on')}
                />
                Do not contact
              </label>
              <label className="checkline">
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
          {error && <span className="field-error-text" role="alert">{error}</span>}
        </Dialog>
      )}

      {pending === 'email' && (
        <Dialog
          title="Send email"
          onClose={close}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button
                variant="primary"
                disabled={busy || mailable.length === 0 || !subject.trim() || !body.trim()}
                onClick={() => void applyEmail()}
              >
                {busy ? 'Sending…' : 'Send'}
              </Button>
            </>
          )}
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
          {error && <span className="field-error-text" role="alert">{error}</span>}
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
