import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/ui/Button';
import { relatedHref, relatedLabel } from '../lib/relatedLink';

interface Task {
  id: string;
  subject: string;
  due_date: string | null;
  priority: string | null;
  status: string;
  related_type: string | null;
  related_id: string | null;
}

const DONE = new Set(['done', 'complete', 'completed', 'closed']);

function dueLabel(due: string | null): { text: string; overdue: boolean } {
  if (!due) return { text: 'No due date', overdue: false };
  const at = new Date(`${due}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((at.getTime() - today.getTime()) / 86400000);
  const stamp = at.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (days === 0) return { text: `${stamp} (today)`, overdue: false };
  if (days < 0) {
    const n = Math.abs(days);
    return { text: `${stamp} (${n} ${n === 1 ? 'day' : 'days'} overdue)`, overdue: true };
  }
  return { text: `${stamp} (in ${days} ${days === 1 ? 'day' : 'days'})`, overdue: false };
}

export function MyTasks() {
  const { staff } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    if (!staff?.id) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, subject, due_date, priority, status, related_type, related_id')
      .eq('assignee_id', staff.id)
      .order('due_date', { ascending: true, nullsFirst: false });
    const next = ((data ?? []) as Task[]).filter((t) => !DONE.has((t.status ?? '').toLowerCase()));
    setRows(next);
    setLoading(false);
    setStatus(`${next.length} open task${next.length === 1 ? '' : 's'}.`);
  }, [staff?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!staff?.id) return;
    const channel = supabase
      .channel('my-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, staff?.id]);

  const complete = async (id: string) => {
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', id);
    if (error) {
      setStatus('Could not complete that task.');
      return;
    }
    void load();
  };

  return (
    <div className="tasks-panel">
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      {loading ? (
        <p>Loading tasks...</p>
      ) : rows.length === 0 ? (
        <p>Task list is empty.</p>
      ) : (
        <ul className="task-list">
          {rows.map((t) => {
            const href = relatedHref(t.related_type, t.related_id);
            const due = dueLabel(t.due_date);
            return (
              <li key={t.id} className={due.overdue ? 'task-row is-overdue' : 'task-row'}>
                <span className="task-due">{due.text}</span>
                <span className="task-subject">
                  {href ? (
                    <button type="button" className="link-btn" onClick={() => navigate(href)}>
                      {t.subject}
                    </button>
                  ) : (
                    t.subject
                  )}
                </span>
                <span className="task-related">{relatedLabel(t.related_type)}</span>
                {t.priority ? <span className="task-priority">{t.priority}</span> : null}
                <Button size="sm" variant="ghost" onClick={() => void complete(t.id)}>
                  Complete
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
