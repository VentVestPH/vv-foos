import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, FileText, ImagePlus, MessageSquare, Paperclip, X } from 'lucide-react';
import { FoDialog } from '../../../components/ui/FoDialog';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { DateField } from '../../../components/ui/DateField';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useSession } from '../../../auth/SessionProvider';
import { supabase } from '../../../lib/supabase';
import { useCanEditCrm, useCompanyOptions, useContactOptions, useStaffList } from '../hooks';
import type { Tables, TablesInsert } from '../../../lib/database.types';
import { TicketDetailView } from './TicketDetailView';
import { TicketRichText, type RichTextHandle } from './TicketRichText';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import {
  TICKET_COMMENT_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  dueIso,
  htmlForStorage,
  htmlToText,
  preparePendingFiles,
  referencedPendingIds,
  releasePreviews,
  removeTicketFiles,
  uploadTicketFiles,
  type PendingFile,
} from './ticketContent';

type TicketRow = Tables<'tickets'>;

const CREATE_STATUS_OPTIONS = TICKET_STATUS_OPTIONS.filter((option) => ['new', 'open', 'pending'].includes(option.value));

function TicketDetailSkeleton() {
  const canComment = useCanEditCrm();
  return (
    <div className="sales-ticket-workitem sales-ticket-detail-skeleton" role="status" aria-label="Loading ticket details">
      <div className="sales-ticket-content">
        <div className="sales-ticket-skeleton-title"><Skeleton rows={1} label="Loading ticket title" /></div>
        <section className="sales-ticket-description">
          <span className="skeleton-row sales-ticket-skeleton-label" />
          <div className="sales-ticket-skeleton-lines"><span className="skeleton-row" /><span className="skeleton-row" /><span className="skeleton-row" /></div>
        </section>
        <section className="sales-ticket-comments">
          <div className="sales-ticket-skeleton-comment-heading"><span className="skeleton-row" /><span className="skeleton-row" /></div>
          {canComment && <div className="sales-ticket-skeleton-comment-box"><span className="skeleton-row" /><span className="skeleton-row" /></div>}
        </section>
      </div>
      <aside className="sales-ticket-sidebar" aria-hidden="true">
        <div className="sales-ticket-sidebar-title"><span>FIELDS</span><span className="skeleton-row sales-ticket-skeleton-code" /></div>
        {['status', 'priority', 'assignee', 'due date'].map((field) => (
          <div className="sales-ticket-read-field" key={field}>
            <span>{field}</span><span className="skeleton-row sales-ticket-skeleton-value" />
          </div>
        ))}
      </aside>
    </div>
  );
}

function ExistingTicket({ ticketId, onClose, onSaved }: { ticketId: string; onClose: () => void; onSaved: () => void }) {
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showSkeleton = useMinimumVisible(loading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase.from('tickets').select('*').eq('id', ticketId).maybeSingle().then(({ data, error: queryError }) => {
      if (cancelled) return;
      setError(queryError?.message ?? null);
      setTicket(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  const current = ticket?.id === ticketId ? ticket : null;
  const title = showSkeleton ? 'Loading ticket' : current ? `${current.display_code} · ${current.subject}` : 'Ticket unavailable';
  return (
    <FoDialog title={title} onClose={onClose} wide hideHeader className="sales-ticket-dialog">
      {showSkeleton ? <TicketDetailSkeleton /> : current ? (
        <TicketDetailView
          key={current.id}
          ticket={current}
          onSaved={(updated) => {
            setTicket(updated);
            onSaved();
          }}
        />
      ) : <p className="form-error" role="alert">{error ?? 'This ticket could not be loaded, or you do not have access to it.'}</p>}
    </FoDialog>
  );
}

function NewTicket({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { staff } = useSession();
  const { companyOptions } = useCompanyOptions();
  const { staffOptions } = useStaffList();
  const contacts = useContactOptions();
  const ticketId = useRef(crypto.randomUUID());
  const descriptionEditor = useRef<RichTextHandle | null>(null);
  const [created, setCreated] = useState<TicketRow | null>(null);
  const [subject, setSubject] = useState('');
  const [commentDraft, setCommentDraft] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [personId, setPersonId] = useState('');
  const [assigneeId, setAssigneeId] = useState(staff?.id ?? '');
  const [status, setStatus] = useState('new');
  const [priority, setPriority] = useState('normal');
  const [slaDate, setSlaDate] = useState('');
  const [slaTime, setSlaTime] = useState('17:00');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  useEffect(() => () => releasePreviews(filesRef.current), []);

  const contactChoices = useMemo(
    () => contacts.filter((contact) => !companyId || contact.companyId === companyId),
    [companyId, contacts],
  );

  const addFiles = (incoming: File[], inline: boolean) => {
    const { added, error: fileError } = preparePendingFiles(incoming, files.length, inline);
    if (fileError) setError(fileError);
    setFiles((current) => [...current, ...added]);
    return added;
  };

  async function addComment(ticket: TicketRow): Promise<boolean> {
    if (!commentDraft.trim()) return true;
    if (!staff) {
      setError('Your staff profile is not available, so the comment could not be saved.');
      return false;
    }
    const { error: commentError } = await supabase.from('ticket_comments').insert({
      ticket_id: ticket.id, author_id: staff.id, body: commentDraft.trim(),
    });
    if (commentError) {
      setError(`Ticket ${ticket.display_code} was saved, but the comment could not be added: ${commentError.message}`);
      return false;
    }
    setCommentDraft('');
    return true;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (created) {
      setSaving(true);
      const done = await addComment(created);
      setSaving(false);
      if (done) onClose();
      return;
    }
    if (!subject.trim()) {
      setError('Enter a ticket title.');
      return;
    }
    const html = descriptionEditor.current?.html() ?? '';
    if (htmlToText(html).length > TICKET_DESCRIPTION_MAX) {
      setError(`Description must be ${TICKET_DESCRIPTION_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    if (commentDraft.trim().length > TICKET_COMMENT_MAX) {
      setError(`A comment must be ${TICKET_COMMENT_MAX.toLocaleString()} characters or fewer.`);
      return;
    }
    setSaving(true);
    const referenced = referencedPendingIds(html);
    const toUpload = files.filter((file) => !file.inline || referenced.has(file.id));
    const { uploaded, errors } = await uploadTicketFiles(ticketId.current, 'description', toUpload, staff?.id ?? null);
    if (errors.length) {
      await removeTicketFiles(uploaded);
      setSaving(false);
      setError(`Files could not be uploaded: ${errors.join('; ')}`);
      return;
    }
    const payload: TablesInsert<'tickets'> = {
      id: ticketId.current,
      subject: subject.trim(),
      description: htmlForStorage(html, uploaded, []) || null,
      company_id: companyId || null,
      person_id: personId || null,
      assignee_id: assigneeId || null,
      status: status as TicketRow['status'],
      priority: priority || null,
      sla_due_at: dueIso(slaDate, slaTime),
    };
    const { data, error: insertError } = await supabase.from('tickets').insert(payload).select('*').single();
    if (insertError || !data) {
      await removeTicketFiles(uploaded);
      setSaving(false);
      setError(insertError?.message ?? 'Ticket could not be saved.');
      return;
    }
    setCreated(data);
    onSaved();
    const done = await addComment(data);
    setSaving(false);
    if (done) onClose();
  }

  const locked = created !== null;

  return (
    <FoDialog
      title="New ticket"
      onClose={onClose}
      wide
      className="sales-ticket-dialog sales-ticket-create-dialog"
      footer={<>
        <Button type="button" onClick={onClose} disabled={saving}>{locked ? 'Close' : 'Cancel'}</Button>
        <Button type="submit" form="ticket-create-form" variant="primary" loading={saving} disabled={saving}>{locked ? 'Retry comment' : 'Create ticket'}</Button>
      </>}
    >
      <form id="ticket-create-form" className="sales-ticket-form" onSubmit={(event) => void save(event)} noValidate>
        {created && <p className="sales-ticket-saved-note" role="status">Ticket {created.display_code} is saved. Retry to add the comment.</p>}
        <div className="sales-ticket-editor-layout">
          <aside className="sales-ticket-sidebar sales-ticket-create-sidebar" aria-label="Ticket fields">
            <div className="sales-ticket-sidebar-title"><span>FIELDS</span><span>Ownership and tracking</span></div>
            <Select label="Status" options={CREATE_STATUS_OPTIONS} value={status} onChange={(event) => setStatus(event.target.value)} disabled={locked} />
            <Select label="Priority" options={TICKET_PRIORITY_OPTIONS} value={priority} onChange={(event) => setPriority(event.target.value)} disabled={locked} />
            <Select label="Assignee" options={staffOptions} value={assigneeId} placeholder="Unassigned" onChange={(event) => setAssigneeId(event.target.value)} disabled={locked} />
            <Select label="Account" options={companyOptions} value={companyId} placeholder="Choose an account" onChange={(event) => {
              const next = event.target.value;
              setCompanyId(next);
              if (personId && contacts.find((contact) => contact.value === personId)?.companyId !== next) setPersonId('');
            }} disabled={locked} />
            <Select label="Contact" options={contactChoices} value={personId} placeholder="Choose a contact" onChange={(event) => setPersonId(event.target.value)} disabled={locked} emptyLabel="No contacts on this account" />
            <div className="field">
              <label className="field-label" htmlFor="ticket-sla-date">SLA due</label>
              <div className="sales-ticket-due-row">
                <DateField id="ticket-sla-date" value={slaDate} onChange={(event) => setSlaDate(event.target.value)} disabled={locked} className="sales-ticket-date-field" />
                <Input label="Time" type="time" step={60} className="input sales-ticket-time-input" value={slaTime} onChange={(event) => setSlaTime(event.target.value)} disabled={locked} />
              </div>
            </div>
          </aside>
          <section className="sales-ticket-editor-main" aria-label="Ticket content">
            <Input label="Title" required value={subject} onChange={(event) => setSubject(event.target.value)} aria-required="true" maxLength={180} autoFocus placeholder="What needs attention?" disabled={locked} />
            <div className="field">
              <span className="field-label">Description</span>
              <TicketRichText
                ref={descriptionEditor}
                id="ticket-description"
                label="Description"
                className="sales-textarea sales-ticket-description-input"
                placeholder="Add context, steps to reproduce, or paste a screenshot…"
                onFiles={addFiles}
              />
              <span className="field-hint">Paste images into the description or attach files. Files upload when you save.</span>
            </div>
            {files.some((file) => !file.inline) && (
              <div className="sales-ticket-image-drafts" aria-label="Files to upload when the ticket is saved">
                {files.filter((file) => !file.inline).map((file) => (
                  <figure key={file.id}>
                    {file.preview ? <img src={file.preview} alt={`Pending ${file.file.name}`} /> : <FileText size={32} aria-hidden="true" />}
                    <figcaption title={file.file.name}>{file.file.name}</figcaption>
                    <button type="button" aria-label={`Remove ${file.file.name}`} disabled={locked} onClick={() => {
                      releasePreviews([file]);
                      setFiles((current) => current.filter((item) => item.id !== file.id));
                    }}><X size={20} aria-hidden="true" /></button>
                  </figure>
                ))}
              </div>
            )}
            {!locked && (
              <label className="sales-ticket-file-button">
                <ImagePlus size={20} aria-hidden="true" /> Add images or files
                <input type="file" multiple onChange={(event) => {
                  if (event.currentTarget.files) addFiles(Array.from(event.currentTarget.files), false);
                  event.currentTarget.value = '';
                }} />
              </label>
            )}
            <section className="sales-ticket-comments sales-ticket-create-comments" aria-labelledby="ticket-create-comment-heading">
              <h2 id="ticket-create-comment-heading"><MessageSquare size={20} aria-hidden="true" /> Comment <span>Optional</span></h2>
              <label className="field-label" htmlFor="ticket-initial-comment">Add context for your team</label>
              <textarea id="ticket-initial-comment" className="sales-textarea" rows={4} maxLength={TICKET_COMMENT_MAX} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="Add the first comment or update…" />
            </section>
          </section>
        </div>
        {error && <p className="form-error" role="alert"><AlertCircle size={20} aria-hidden="true" /> {error}</p>}
        {saving && files.length > 0 && <p role="status"><Paperclip size={20} aria-hidden="true" /> Uploading files…</p>}
      </form>
    </FoDialog>
  );
}

export function TicketDialog({ ticketId, onClose, onSaved }: { ticketId: string | null; onClose: () => void; onSaved: () => void }) {
  return ticketId
    ? <ExistingTicket ticketId={ticketId} onClose={onClose} onSaved={onSaved} />
    : <NewTicket onClose={onClose} onSaved={onSaved} />;
}
