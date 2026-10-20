import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSession } from '../auth/SessionProvider';
import { KanbanBoard } from '../components/ui/KanbanBoard';
import { KanbanSkeleton } from '../components/ui/KanbanSkeleton';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import { useBackstopRefresh } from '../lib/useBackstopRefresh';
import { dueLabel } from './MyTasks';

const COLUMN_LIMIT = 25;

const COLUMNS = [
  { key: 'backlog', label: 'Backlog', statuses: ['open', 'Not Started'], writes: 'open' },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'], writes: 'in_progress' },
  { key: 'done', label: 'Done', statuses: ['done', 'Completed'], writes: 'done' },
  { key: 'cancelled', label: 'Cancelled', statuses: ['cancelled'], writes: 'cancelled' },
] as const;

type ColumnKey = (typeof COLUMNS)[number]['key'];

interface BoardTask {
  id: string;
  subject: string;
  due_date: string | null;
  priority: string | null;
  column: ColumnKey;
}

const STAGES = COLUMNS.map(({ key, label }) => ({ key, label }));

export function MyTaskBoard({ refreshKey = 0 }: { refreshKey?: number }) {
  const { staff } = useSession();
  const [tasks, setTasks] = useState<BoardTask[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const showSkeleton = useMinimumVisible(loading);
  const movesInFlight = useRef(0);

  const load = useCallback(async () => {
    if (!staff?.id || movesInFlight.current > 0) return;
    const results = await Promise.all(
      COLUMNS.map(async (column) => {
        const { data, error, count } = await supabase
          .from('tasks')
          .select('id, subject, due_date, priority', { count: 'exact' })
          .eq('assignee_id', staff.id)
          .in('status', [...column.statuses])
          .order('due_date', { ascending: true, nullsFirst: false })
          .order('id')
          .limit(COLUMN_LIMIT);
        return { column, rows: data ?? [], count: count ?? 0, failed: error !== null };
      }),
    );
    if (results.some((r) => r.failed)) {
      setStatus('Could not load your tasks.');
      setLoading(false);
      return;
    }
    setTasks(results.flatMap(({ column, rows }) => rows.map((t) => ({ ...t, column: column.key }))));
    setCounts(Object.fromEntries(results.map(({ column, count }) => [column.key, count])));
    setLoading(false);
  }, [staff?.id]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useBackstopRefresh(load);

  const move = useCallback(
    (taskId: string, to: string) => {
      const target = COLUMNS.find((c) => c.key === to);
      const task = tasks.find((t) => t.id === taskId);
      if (!target || !task || task.column === target.key) return;
      const from = task.column;
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, column: target.key } : t)));
      setCounts((prev) => ({
        ...prev,
        [from]: Math.max(0, (prev[from] ?? 0) - 1),
        [target.key]: (prev[target.key] ?? 0) + 1,
      }));
      movesInFlight.current += 1;
      void supabase
        .from('tasks')
        .update({ status: target.writes })
        .eq('id', taskId)
        .select('id')
        .then(({ data, error }) => {
          movesInFlight.current -= 1;
          if (error || !data?.length) {
            setStatus(`Could not move "${task.subject}".`);
            void load();
            return;
          }
          setStatus(`Moved "${task.subject}" to ${target.label}.`);
        });
    },
    [tasks, load],
  );

  const cards = useMemo(
    () =>
      tasks.map((t) => {
        const due = dueLabel(t.due_date);
        const overdue = due.overdue && t.column !== 'done' && t.column !== 'cancelled';
        return {
          id: t.id,
          stage: t.column,
          content: (
            <>
              <div className="task-board-title">{t.subject}</div>
              <div className={overdue ? 'task-board-meta is-overdue' : 'task-board-meta'}>
                {due.text}
                {t.priority ? ` · ${t.priority}` : ''}
              </div>
            </>
          ),
        };
      }),
    [tasks],
  );

  if (showSkeleton) return <KanbanSkeleton stages={STAGES} label="Loading your tasks" />;

  return (
    <div className="task-board">
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      <KanbanBoard stages={STAGES} cards={cards} stageCounts={counts} onMove={move} />
    </div>
  );
}
