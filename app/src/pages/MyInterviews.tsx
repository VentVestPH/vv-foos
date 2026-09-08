import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { relatedHref } from '../lib/relatedLink';
import { supabase } from '../lib/supabase';
import { NewCalendarEntryDialog } from './NewCalendarEntryDialog';
import { useMinimumVisible } from '../hooks/useMinimumVisible';

interface Interview {
  id: string;
  subject: string | null;
  occurred_at: string;
  person_id: string | null;
  application_id: string | null;
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MyInterviews() {
  const { staff } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const showSkeleton = useMinimumVisible(loading);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('activities')
      .select('id, subject, occurred_at, person_id, application_id')
      .eq('kind', 'meeting')
      .gte('occurred_at', new Date().toISOString())
      .order('occurred_at', { ascending: true })
      .limit(50);
    setRows(((data ?? []) as Interview[]).filter((r) => r.person_id || r.application_id));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="record-section-inline-actions">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Schedule interview
        </Button>
      </div>
      {showSkeleton ? (
        <Skeleton rows={4} />
      ) : rows.length === 0 ? (
        <p>There are currently no interviews scheduled.</p>
      ) : (
        <ul className="task-list">
          {rows.map((r) => {
            const href = r.person_id
              ? relatedHref('person', r.person_id)
              : relatedHref('application', r.application_id);
            return (
              <li key={r.id} className="task-row" data-kind="meeting">
                <span className="task-due">{whenLabel(r.occurred_at)}</span>
                <span className="task-subject">
                  {href ? (
                    <button type="button" className="link-btn" onClick={() => navigate(href)}>
                      {r.subject ?? '(no subject)'}
                    </button>
                  ) : (
                    (r.subject ?? '(no subject)')
                  )}
                </span>
                <span className="task-related">interview</span>
              </li>
            );
          })}
        </ul>
      )}
      {open && (
        <NewCalendarEntryDialog
          mode="interview"
          staffId={staff?.id ?? null}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}
