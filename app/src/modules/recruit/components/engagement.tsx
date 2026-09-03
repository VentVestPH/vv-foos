import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import type {
  ActivityKind,
  AttachmentKind,
  TablesInsert,
} from '../../../lib/database.types';
import type { Activity, Attachment, Reminder, TaskRow } from '../lib';
import { supabase } from '../../../lib/supabase';
import { errMsg, fmtDate, fmtDateTime } from '../lib';
import {
  attachmentRejection,
  isPendingFile,
  PENDING_FILE_LABEL,
  PENDING_FILE_REASON,
} from '../../../lib/attachments';

export type EngagementParentType = 'person' | 'requisition' | 'application';

interface EngagementParent {
  type: EngagementParentType;
  id: string;
}

export function useEngagement(parentType: EngagementParentType, parentId: string) {
  const { staff } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const activityCol =
        parentType === 'person'
          ? 'person_id'
          : parentType === 'application'
            ? 'application_id'
            : 'requisition_id';
      const [a, t, r, f] = await Promise.all([
        supabase
          .from('activities')
          .select('*')
          .eq(activityCol, parentId)
          .order('occurred_at', { ascending: false }),
        supabase
          .from('tasks')
          .select('*')
          .eq('related_type', parentType)
          .eq('related_id', parentId),
        supabase
          .from('reminders')
          .select('*')
          .eq('related_type', parentType)
          .eq('related_id', parentId)
          .order('remind_at'),
        supabase
          .from('attachments')
          .select('*')
          .eq('parent_type', parentType)
          .eq('parent_id', parentId)
          .order('uploaded_at', { ascending: false }),
      ]);
      const firstError = a.error ?? t.error ?? r.error ?? f.error ?? null;
      if (firstError) throw new Error(firstError.message);
      setActivities(a.data ?? []);
      setTasks(t.data ?? []);
      setReminders(r.data ?? []);
      setAttachments(f.data ?? []);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [parentType, parentId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addActivity = useCallback(
    async (kind: ActivityKind, subject: string, body: string) => {
      const row: TablesInsert<'activities'> = {
        kind,
        subject,
        body: body || null,
        created_by: staff?.id ?? null,
      };
      if (parentType === 'person') {
        row.person_id = parentId;
      } else {
        row.requisition_id = parentId;
      }
      const { error: err } = await supabase.from('activities').insert(row);
      if (err) setError(err.message);
      else await refresh();
    },
    [parentType, parentId, staff, refresh],
  );

  const addTask = useCallback(
    async (subject: string, dueDate: string) => {
      const { error: err } = await supabase.from('tasks').insert({
        subject,
        due_date: dueDate || null,
        status: 'open',
        assignee_id: staff?.id ?? null,
        related_type: parentType,
        related_id: parentId,
      });
      if (err) setError(err.message);
      else await refresh();
    },
    [parentType, parentId, staff, refresh],
  );

  const toggleTask = useCallback(
    async (task: TaskRow) => {
      const { error: err } = await supabase
        .from('tasks')
        .update({ status: task.status === 'done' ? 'open' : 'done' })
        .eq('id', task.id);
      if (err) setError(err.message);
      else await refresh();
    },
    [refresh],
  );

  const addReminder = useCallback(
    async (subject: string, remindAt: string) => {
      if (!staff) return;
      const { error: err } = await supabase.from('reminders').insert({
        staff_id: staff.id,
        subject,
        remind_at: new Date(remindAt).toISOString(),
        related_type: parentType,
        related_id: parentId,
      });
      if (err) setError(err.message);
      else await refresh();
    },
    [parentType, parentId, staff, refresh],
  );

  const dismissReminder = useCallback(
    async (id: string) => {
      const { error: err } = await supabase
        .from('reminders')
        .update({ status: 'dismissed' })
        .eq('id', id);
      if (err) setError(err.message);
      else await refresh();
    },
    [refresh],
  );

  return {
    activities,
    tasks,
    reminders,
    attachments,
    error,
    refresh,
    addActivity,
    addTask,
    toggleTask,
    addReminder,
    dismissReminder,
  };
}

async function uploadAttachment(
  parent: EngagementParent,
  file: File,
  kind: AttachmentKind,
  uploadedBy: string | null,
): Promise<string | null> {
  const rejection = attachmentRejection(file);
  if (rejection) return rejection;
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_');
  const path = `${parent.type}/${parent.id}/${Date.now()}_${safeName}`;
  const up = await supabase.storage.from('attachments').upload(path, file);
  if (up.error) return up.error.message;
  const ins = await supabase.from('attachments').insert({
    storage_path: path,
    parent_type: parent.type,
    parent_id: parent.id,
    kind,
    description: file.name,
    uploaded_by: uploadedBy,
  });
  return ins.error ? ins.error.message : null;
}

export async function attachmentUrl(storagePath: string): Promise<string | null> {
  if (isPendingFile(storagePath)) return null;
  const { data, error } = await supabase.storage
    .from('attachments')
    .createSignedUrl(storagePath, 3600);
  return error ? null : data.signedUrl;
}

function attachmentName(a: Attachment): string {
  if (a.description) return a.description;
  const base = a.storage_path.split('/').pop() ?? a.storage_path;
  return base.replace(/^\d+_/, '');
}

interface ActivityPanelProps {
  items: Activity[];
  kind: ActivityKind;
  kindLabel: string;
  emptyText: string;
  allowCreate: boolean;
  onCreate: (kind: ActivityKind, subject: string, body: string) => Promise<void>;
}

export function ActivityPanel({
  items,
  kind,
  kindLabel,
  emptyText,
  allowCreate,
  onCreate,
}: ActivityPanelProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel-stack">
      {allowCreate && (
        <form
          className="panel-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!subject.trim() || busy) return;
            setBusy(true);
            void onCreate(kind, subject.trim(), body.trim()).finally(() => {
              setSubject('');
              setBody('');
              setBusy(false);
            });
          }}
        >
          <Input
            label={`New ${kindLabel.toLowerCase()}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
          />
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Details (optional)"
            aria-label={`${kindLabel} details`}
          />
          <div>
            <Button size="sm" variant="primary" type="submit" disabled={busy || !subject.trim()}>
              Log {kindLabel.toLowerCase()}
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 && <p className="text-secondary">{emptyText}</p>}
      {items.map((a) => (
        <div key={a.id} className="panel-item">
          <div className="panel-item-head">
            <span className="panel-item-title">{a.subject ?? kindLabel}</span>
            <span className="text-secondary">{fmtDateTime(a.occurred_at)}</span>
          </div>
          {a.body && <p className="panel-item-body">{a.body}</p>}
        </div>
      ))}
    </div>
  );
}

export function EventsPanel({ items }: { items: Activity[] }) {
  if (items.length === 0) {
    return <p className="text-secondary">No calendar events linked yet.</p>;
  }
  return (
    <div className="panel-stack">
      {items.map((a) => {
        const attendees = Array.isArray(a.attendees)
          ? (a.attendees as unknown[])
              .map((x) =>
                typeof x === 'string'
                  ? x
                  : ((x as Record<string, unknown>)?.email ??
                      (x as Record<string, unknown>)?.name ??
                      ''),
              )
              .filter(Boolean)
              .join(', ')
          : '';
        return (
          <div key={a.id} className="panel-item">
            <div className="panel-item-head">
              <span className="panel-item-title">{a.subject ?? 'Event'}</span>
              <span className="text-secondary">{fmtDateTime(a.occurred_at)}</span>
            </div>
            {attendees && (
              <p className="panel-item-body">Attendees: {attendees}</p>
            )}
            {a.body && <p className="panel-item-body">{a.body}</p>}
          </div>
        );
      })}
    </div>
  );
}

interface TasksPanelProps {
  items: TaskRow[];
  allowCreate: boolean;
  onCreate: (subject: string, dueDate: string) => Promise<void>;
  onToggle: (task: TaskRow) => Promise<void>;
}

export function TasksPanel({ items, allowCreate, onCreate, onToggle }: TasksPanelProps) {
  const [subject, setSubject] = useState('');
  const [due, setDue] = useState('');
  return (
    <div className="panel-stack">
      {allowCreate && (
        <form
          className="panel-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!subject.trim()) return;
            void onCreate(subject.trim(), due);
            setSubject('');
            setDue('');
          }}
        >
          <Input
            label="New task"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            required
          />
          <Input
            label="Due date"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <div>
            <Button size="sm" variant="primary" type="submit" disabled={!subject.trim()}>
              Add task
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 && <p className="text-secondary">No tasks yet.</p>}
      {items.map((t) => (
        <div key={t.id} className="panel-item">
          <div className="panel-item-head">
            <label className="rq-checkline">
              <input
                type="checkbox"
                checked={t.status === 'done'}
                onChange={() => void onToggle(t)}
                aria-label={`Mark task ${t.subject} ${t.status === 'done' ? 'open' : 'done'}`}
              />
              <span className="panel-item-title">{t.subject}</span>
            </label>
            <span className="text-secondary">
              {t.due_date ? `Due ${fmtDate(t.due_date)}` : ''}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface RemindersPanelProps {
  items: Reminder[];
  allowCreate: boolean;
  onCreate: (subject: string, remindAt: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

export function RemindersPanel({
  items,
  allowCreate,
  onCreate,
  onDismiss,
}: RemindersPanelProps) {
  const [subject, setSubject] = useState('');
  const [at, setAt] = useState('');
  return (
    <div className="panel-stack">
      {allowCreate && (
        <form
          className="panel-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!subject.trim() || !at) return;
            void onCreate(subject.trim(), at);
            setSubject('');
            setAt('');
          }}
        >
          <Input
            label="New reminder"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Follow up on…"
            required
          />
          <Input
            label="Remind at"
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            required
          />
          <div>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              disabled={!subject.trim() || !at}
            >
              Add reminder
            </Button>
          </div>
        </form>
      )}
      {items.length === 0 && <p className="text-secondary">No reminders yet.</p>}
      {items.map((r) => (
        <div key={r.id} className="panel-item">
          <div className="panel-item-head">
            <span className="panel-item-title">{r.subject}</span>
            <span className="text-secondary">{fmtDateTime(r.remind_at)}</span>
          </div>
          <div className="panel-item-head">
            <Badge tone={r.status === 'pending' ? 'warning' : 'neutral'}>
              {r.status}
            </Badge>
            {r.status !== 'dismissed' && allowCreate && (
              <Button size="sm" variant="ghost" onClick={() => void onDismiss(r.id)}>
                Dismiss
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface AttachmentsPanelProps {
  items: Attachment[];
  parent: EngagementParent;

  fixedKind?: AttachmentKind;
  allowUpload: boolean;
  onChanged: () => Promise<void>;

  preview?: boolean;
}

export function AttachmentsPanel({
  items,
  parent,
  fixedKind,
  allowUpload,
  onChanged,
  preview = false,
}: AttachmentsPanelProps) {
  const { staff } = useSession();
  const [kind, setKind] = useState<AttachmentKind>(fixedKind ?? 'other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    const err = await uploadAttachment(parent, file, fixedKind ?? kind, staff?.id ?? null);
    setError(err);
    if (!err) await onChanged();
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const open = async (a: Attachment) => {
    if (isPendingFile(a.storage_path)) {
      setError(PENDING_FILE_REASON);
      return;
    }
    const url = await attachmentUrl(a.storage_path);
    if (url) window.open(url, '_blank', 'noopener');
    else setError('Could not create a download link.');
  };

  const newest = items[0];

  return (
    <div className="panel-stack">
      {allowUpload && (
        <div className="panel-form">
          {!fixedKind && (
            <Select
              label="Kind"
              options={['resume', 'cover', 'contract', 'offer', 'other'].map((k) => ({
                value: k,
                label: k,
              }))}
              value={kind}
              onChange={(e) => setKind(e.target.value as AttachmentKind)}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            aria-label={fixedKind === 'resume' ? 'Upload resume' : 'Upload file'}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {busy && <span className="text-secondary">Uploading…</span>}
        </div>
      )}
      {error && <p className="rq-error">{error}</p>}
      {items.length === 0 && (
        <p className="text-secondary">
          {fixedKind === 'resume' ? 'No resumes yet.' : 'No files yet.'}
        </p>
      )}
      {items.map((a) => (
        <div key={a.id} className="panel-item">
          <div className="panel-item-head">
            {isPendingFile(a.storage_path) ? (
              <span className="file-pending-name" title={PENDING_FILE_REASON}>
                {attachmentName(a)}
              </span>
            ) : (
              <button type="button" className="link-btn" onClick={() => void open(a)}>
                {attachmentName(a)}
              </button>
            )}
            <span className="text-secondary">{fmtDate(a.uploaded_at)}</span>
          </div>
          <div className="panel-item-head">
            <Badge tone="neutral">{a.kind}</Badge>
            {isPendingFile(a.storage_path) && (
              <Badge tone="warning">{PENDING_FILE_LABEL}</Badge>
            )}
            {fixedKind === 'resume' && newest && a.id === newest.id && (
              <Badge tone="success">Current</Badge>
            )}
          </div>
        </div>
      ))}
      {preview && newest && <ResumePreview attachment={newest} />}
    </div>
  );
}

export function ResumePreview({ attachment }: { attachment: Attachment }) {
  const pending = isPendingFile(attachment.storage_path);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (pending) return;
    let live = true;
    setFailed(false);
    void attachmentUrl(attachment.storage_path).then((u) => {
      if (!live) return;
      setUrl(u);
      setFailed(u === null);
    });
    return () => {
      live = false;
    };
  }, [attachment.storage_path, pending]);
  if (pending) {
    return (
      <p className="file-pending-note">
        {PENDING_FILE_LABEL}. {PENDING_FILE_REASON}
      </p>
    );
  }
  if (failed) {
    return <p className="rq-error">Could not load this resume preview.</p>;
  }
  if (!url) return <p className="text-secondary">Loading resume preview…</p>;
  return <iframe className="resume-preview" src={url} title="Resume preview" />;
}
