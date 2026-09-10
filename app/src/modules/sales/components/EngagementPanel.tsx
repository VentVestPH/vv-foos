import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useSession } from '../../../auth/SessionProvider';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { SidePanelTabs } from '../../../components/ui/SidePanelTabs';
import { Timeline, type TimelineItem } from '../../../components/ui/Timeline';
import { useStaffList } from '../hooks';
import {
  fmtDate,
  TASK_PRIORITIES,
  type Activity,
  type Attachment,
  type Reminder,
  type TaskRow,
} from '../lib';
import { Modal } from './Modal';
import { isPendingFile, PENDING_FILE_LABEL, PENDING_FILE_REASON } from '../../../lib/attachments';
import { BellRing, ListChecks, MessageSquare, Paperclip } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';

type EngagementParent = 'person' | 'company' | 'deal';

interface EngagementPanelProps {
  relatedType: EngagementParent;
  relatedId: string;

  refreshKey?: number;
}

type QuickAddKind = 'note' | 'call' | 'task' | 'reminder' | null;

function activityQuery(relatedType: EngagementParent, relatedId: string) {
  const q = supabase.from('activities').select('*');
  if (relatedType === 'person') return q.eq('person_id', relatedId);
  if (relatedType === 'company') return q.eq('company_id', relatedId);
  return q.eq('deal_id', relatedId);
}

function hasAttendees(a: Activity): boolean {
  if (a.attendees === null || a.attendees === undefined) return false;
  if (Array.isArray(a.attendees)) return a.attendees.length > 0;
  return true;
}

function ActivityList({
  items,
  emptyText,
  note,
}: {
  items: Activity[];
  emptyText: string;
  note?: string;
}) {
  return (
    <>
      {items.length === 0 ? (
        <EmptyState compact icon={<MessageSquare size={32} />} title={emptyText} />
      ) : (
        <ul className="sales-panel-list">
          {items.map((a) => (
            <li key={a.id} className="sales-panel-item">
              <div className="sales-panel-item-head">
                <span className="sales-panel-item-title">
                  {a.subject ?? '(no subject)'}
                </span>
                <span className="sales-panel-item-meta">
                  {fmtDate(a.occurred_at)}
                </span>
              </div>
              {a.body && (
                <div className="sales-panel-item-body">{a.body}</div>
              )}
              {a.gmail_message_id && <Badge tone="outline">Gmail</Badge>}
              {a.gcal_event_id && <Badge tone="outline">Calendar</Badge>}
            </li>
          ))}
        </ul>
      )}
      {note && <div className="sales-panel-note">{note}</div>}
    </>
  );
}

export function EngagementPanel({
  relatedType,
  relatedId,
  refreshKey = 0,
}: EngagementPanelProps) {
  const { staff } = useSession();
  const { staffName } = useStaffList();

  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [quickAdd, setQuickAdd] = useState<QuickAddKind>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('normal');
  const [remindAt, setRemindAt] = useState('');

  const refresh = useCallback(async () => {
    const [act, tk, rem, att] = await Promise.all([
      activityQuery(relatedType, relatedId).order('occurred_at', {
        ascending: false,
      }),
      supabase
        .from('tasks')
        .select('*')
        .eq('related_type', relatedType)
        .eq('related_id', relatedId),
      supabase
        .from('reminders')
        .select('*')
        .eq('related_type', relatedType)
        .eq('related_id', relatedId),
      supabase
        .from('attachments')
        .select('*')
        .eq('parent_type', relatedType)
        .eq('parent_id', relatedId),
    ]);
    setActivities(act.data ?? []);
    setTasks(tk.data ?? []);
    setReminders(rem.data ?? []);
    setAttachments(att.data ?? []);
  }, [relatedType, relatedId]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const openQuickAdd = (kind: Exclude<QuickAddKind, null>) => {
    setSubject('');
    setBody('');
    setDueDate('');
    setPriority('normal');
    setRemindAt('');
    setSaveError(null);
    setQuickAdd(kind);
  };

  const parentColumn =
    relatedType === 'person'
      ? { person_id: relatedId }
      : relatedType === 'company'
        ? { company_id: relatedId }
        : { deal_id: relatedId };

  const submitQuickAdd = async () => {
    if (!subject.trim()) {
      setSaveError('Subject is required.');
      return;
    }
    setSaveError(null);
    let error: { message: string } | null = null;

    if (quickAdd === 'note' || quickAdd === 'call') {
      ({ error } = await supabase.from('activities').insert({
        kind: quickAdd,
        subject: subject.trim(),
        body: body.trim() || null,
        created_by: staff?.id ?? null,
        ...parentColumn,
      }));
    } else if (quickAdd === 'task') {
      ({ error } = await supabase.from('tasks').insert({
        subject: subject.trim(),
        due_date: dueDate || null,
        priority,
        assignee_id: staff?.id ?? null,
        related_type: relatedType,
        related_id: relatedId,
      }));
    } else if (quickAdd === 'reminder') {
      if (!remindAt) {
        setSaveError('A remind-at time is required.');
        return;
      }
      if (!staff) {
        setSaveError('No active staff session.');
        return;
      }
      ({ error } = await supabase.from('reminders').insert({
        staff_id: staff.id,
        subject: subject.trim(),
        remind_at: new Date(remindAt).toISOString(),
        related_type: relatedType,
        related_id: relatedId,
      }));
    }

    if (error) {
      setSaveError(error.message);
      return;
    }
    setQuickAdd(null);
    await refresh();
  };

  const completeTask = async (t: TaskRow) => {
    await supabase.from('tasks').update({ status: 'done' }).eq('id', t.id);
    await refresh();
  };

  const dismissReminder = async (r: Reminder) => {
    await supabase
      .from('reminders')
      .update({ status: 'dismissed' })
      .eq('id', r.id);
    await refresh();
  };

  const notes = activities.filter((a) => a.kind === 'note');
  const calls = activities.filter((a) => a.kind === 'call');
  const meetings = activities.filter((a) => a.kind === 'meeting');
  const events = meetings.filter(hasAttendees);
  const emails = activities.filter((a) => a.kind === 'email');

  const timelineItems: TimelineItem[] = activities.map((a) => ({
    id: a.id,
    kind: a.kind,
    subject: a.subject,
    body: a.body,
    occurred_at: a.occurred_at,
    meta: a.created_by ? staffName(a.created_by) : undefined,
  }));

  const quickAddTitles: Record<Exclude<QuickAddKind, null>, string> = {
    note: 'Log a note',
    call: 'Log a call',
    task: 'Add a task',
    reminder: 'Add a reminder',
  };

  return (
    <div className="sales-engagement">
      <div className="sales-engagement-main">
        <div className="sales-quickadd">
          <Button size="sm" onClick={() => openQuickAdd('note')}>
            + Note
          </Button>
          <Button size="sm" onClick={() => openQuickAdd('call')}>
            + Call
          </Button>
          <Button size="sm" onClick={() => openQuickAdd('task')}>
            + Task
          </Button>
          <Button size="sm" onClick={() => openQuickAdd('reminder')}>
            + Reminder
          </Button>
        </div>
        <Timeline items={timelineItems} />
      </div>
      <div className="sales-engagement-side">
        <SidePanelTabs
          tabs={[
            {
              key: 'notes',
              label: 'Notes',
              count: notes.length,
              content: <ActivityList items={notes} emptyText="No notes yet." />,
            },
            {
              key: 'calls',
              label: 'Calls',
              count: calls.length,
              content: (
                <ActivityList items={calls} emptyText="No calls logged." />
              ),
            },
            {
              key: 'meetings',
              label: 'Meetings',
              count: meetings.length,
              content: (
                <ActivityList
                  items={meetings}
                  emptyText="No meetings yet."
                  note="Calendar-synced meetings arrive via the Google Calendar integration."
                />
              ),
            },
            {
              key: 'events',
              label: 'Events',
              count: events.length,
              content: (
                <ActivityList
                  items={events}
                  emptyText="No calendar events with attendees."
                />
              ),
            },
            {
              key: 'emails',
              label: 'Emails',
              count: emails.length,
              content: (
                <ActivityList
                  items={emails}
                  emptyText="No linked emails."
                  note="Emails sync from Gmail (Agent 6); manual link/unlink lands with that integration."
                />
              ),
            },
            {
              key: 'tasks',
              label: 'Tasks',
              count: tasks.filter((t) => t.status !== 'done').length,
              content:
                tasks.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<ListChecks size={32} />}
                    title="No tasks yet"
                    hint="Add one above to track follow-up work on this record."
                  />
                ) : (
                  <ul className="sales-panel-list">
                    {tasks.map((t) => (
                      <li key={t.id} className="sales-panel-item">
                        <div className="sales-panel-item-head">
                          <span className="sales-panel-item-title">
                            {t.subject}
                          </span>
                          <span className="sales-panel-item-meta">
                            {fmtDate(t.due_date)}
                          </span>
                        </div>
                        <div className="sales-panel-item-head">
                          <span className="sales-panel-item-meta">
                            {t.priority ?? 'normal'} · {t.status}
                          </span>
                          {t.status !== 'done' && (
                            <Button size="sm" onClick={() => completeTask(t)}>
                              Done
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'reminders',
              label: 'Reminders',
              count: reminders.filter((r) => r.status === 'pending').length,
              content:
                reminders.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<BellRing size={32} />}
                    title="No reminders yet"
                    hint="Set one above and it will fire at the time you pick."
                  />
                ) : (
                  <ul className="sales-panel-list">
                    {reminders.map((r) => (
                      <li key={r.id} className="sales-panel-item">
                        <div className="sales-panel-item-head">
                          <span className="sales-panel-item-title">
                            {r.subject}
                          </span>
                          <span className="sales-panel-item-meta">
                            {new Date(r.remind_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="sales-panel-item-head">
                          <span className="sales-panel-item-meta">
                            {r.status}
                          </span>
                          {r.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => dismissReminder(r)}
                            >
                              Dismiss
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
            },
            {
              key: 'files',
              label: 'Files',
              count: attachments.length,
              content:
                attachments.length === 0 ? (
                  <EmptyState
                    compact
                    icon={<Paperclip size={32} />}
                    title="No files yet"
                    hint="Choose a file above, then press Upload to attach it."
                  />
                ) : (
                  <ul className="sales-panel-list">
                    {attachments.map((f) => (
                      <li key={f.id} className="sales-panel-item">
                        <div className="sales-panel-item-head">
                          <span
                            className="sales-panel-item-title"
                            title={
                              isPendingFile(f.storage_path)
                                ? PENDING_FILE_REASON
                                : undefined
                            }
                          >
                            {f.description ??
                              f.storage_path.split('/').pop() ??
                              f.storage_path}
                          </span>
                          <span className="sales-panel-item-meta">
                            {fmtDate(f.uploaded_at)}
                          </span>
                        </div>
                        <div>
                          <Badge tone="outline">{f.kind}</Badge>
                          {isPendingFile(f.storage_path) && (
                            <Badge tone="warning">{PENDING_FILE_LABEL}</Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ),
            },
          ]}
        />
      </div>

      {quickAdd && (
        <Modal
          title={quickAddTitles[quickAdd]}
          onClose={() => setQuickAdd(null)}
        >
          <Input
            label="Subject"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus
          />
          {(quickAdd === 'note' || quickAdd === 'call') && (
            <div className="field">
              <label className="field-label" htmlFor="sales-quickadd-body">
                Details
              </label>
              <textarea
                id="sales-quickadd-body"
                className="sales-textarea"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          )}
          {quickAdd === 'task' && (
            <>
              <DateField
                label="Due date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Select
                label="Priority"
                options={TASK_PRIORITIES.map((p) => ({ value: p, label: p }))}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </>
          )}
          {quickAdd === 'reminder' && (
            <Input
              label="Remind at"
              type="datetime-local"
              required
              value={remindAt}
              onChange={(e) => setRemindAt(e.target.value)}
            />
          )}
          {saveError && <span className="field-error-text" role="alert">{saveError}</span>}
          <div className="sales-modal-actions">
            <Button onClick={() => setQuickAdd(null)}>Cancel</Button>
            <Button variant="primary" onClick={submitQuickAdd}>
              Save
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
