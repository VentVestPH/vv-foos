import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { relatedHref } from '../lib/relatedLink';
import { supabase } from '../lib/supabase';
import { useMinimumVisible } from '../hooks/useMinimumVisible';

interface GroupTask {
  id: string;
  subject: string;
  due_date: string | null;
  priority: string | null;
  related_type: string | null;
  related_id: string | null;
}

interface TaskGroupPanelProps {
  relatedType: string;
  emptyText: string;
}

const DONE = new Set(['done', 'complete', 'completed', 'closed', 'cancelled']);

function dueLabel(due: string | null): string {
  if (!due) return 'No due date';
  return new Date(`${due}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function TaskGroupPanel({ relatedType, emptyText }: TaskGroupPanelProps) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<GroupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinimumVisible(loading);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, subject, due_date, priority, status, related_type, related_id')
      .eq('related_type', relatedType)
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50);
    setRows(
      ((data ?? []) as (GroupTask & { status: string })[])
        .filter((t) => !DONE.has((t.status ?? '').toLowerCase()))
        .map(({ status: _status, ...rest }) => rest),
    );
    setLoading(false);
  }, [relatedType]);

  useEffect(() => {
    void load();
  }, [load]);

  if (showSkeleton) return <Skeleton rows={5} />;
  if (rows.length === 0) return <p>{emptyText}</p>;

  return (
    <ul className="task-list">
      {rows.map((t) => {
        const href = relatedHref(t.related_type, t.related_id);
        return (
          <li key={t.id} className="task-row" data-kind="task">
            <span className="task-due">{dueLabel(t.due_date)}</span>
            <span className="task-subject">
              {href ? (
                <button type="button" className="link-btn" onClick={() => navigate(href)}>
                  {t.subject}
                </button>
              ) : (
                t.subject
              )}
            </span>
            <span className="task-related">{t.priority ?? 'normal'}</span>
          </li>
        );
      })}
    </ul>
  );
}
