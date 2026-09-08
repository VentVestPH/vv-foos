import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { realtimeChannel } from '../lib/realtimeChannel';
import { supabase } from '../lib/supabase';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { relatedHref, relatedLabel } from '../lib/relatedLink';
import { useBackstopRefresh } from '../lib/useBackstopRefresh';
import { useMinimumVisible } from '../hooks/useMinimumVisible';

interface Reminder {
  id: string;
  subject: string;
  remind_at: string;
  related_type: string | null;
  related_id: string | null;
  status: 'pending' | 'fired' | 'dismissed';
}

function formatWhen(iso: string): string {
  const at = new Date(iso);
  const now = Date.now();
  const diffMinutes = Math.round((at.getTime() - now) / 60000);
  const stamp = at.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (Math.abs(diffMinutes) < 60) {
    const n = Math.abs(diffMinutes);
    const unit = n === 1 ? 'minute' : 'minutes';
    return diffMinutes <= 0 ? `${stamp} (${n} ${unit} ago)` : `${stamp} (in ${n} ${unit})`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 48) {
    const n = Math.abs(diffHours);
    const unit = n === 1 ? 'hour' : 'hours';
    return diffHours <= 0 ? `${stamp} (${n} ${unit} ago)` : `${stamp} (in ${n} ${unit})`;
  }
  return stamp;
}

export function MyReminders() {
  const { staff } = useSession();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const showSkeleton = useMinimumVisible(loading);

  const load = useCallback(async () => {
    if (!staff?.id) return;
    const { data } = await supabase
      .from('reminders')
      .select('id, subject, remind_at, related_type, related_id, status')
      .eq('staff_id', staff.id)
      .in('status', ['fired', 'pending'])
      .order('remind_at', { ascending: true });
    const next = (data ?? []) as Reminder[];
    setRows(next);
    setLoading(false);
    const due = next.filter((r) => r.status === 'fired').length;
    setStatus(
      due > 0
        ? `${due} reminder${due === 1 ? '' : 's'} due.`
        : `${next.length} upcoming reminder${next.length === 1 ? '' : 's'}.`,
    );
  }, [staff?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useBackstopRefresh(load);

  useEffect(() => {
    if (!staff?.id) return;
    const channel = realtimeChannel('my-reminders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `staff_id=eq.${staff.id}`,
        },
        () => {
          void load();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, staff?.id]);

  const dismiss = async (id: string) => {
    const { error } = await supabase.from('reminders').update({ status: 'dismissed' }).eq('id', id);
    if (error) {
      setStatus('Could not dismiss that reminder.');
      return;
    }
    void load();
  };

  const due = rows.filter((r) => r.status === 'fired');
  const upcoming = rows.filter((r) => r.status === 'pending');

  const renderRow = (r: Reminder) => {
    const href = relatedHref(r.related_type, r.related_id);
    return (
      <li key={r.id} className={r.status === 'fired' ? 'reminder-row is-due' : 'reminder-row'}>
        <span className="reminder-when">{formatWhen(r.remind_at)}</span>
        <span className="reminder-subject">
          {href ? (
            <button type="button" className="link-btn" onClick={() => navigate(href)}>
              {r.subject}
            </button>
          ) : (
            r.subject
          )}
        </span>
        <span className="reminder-related">{relatedLabel(r.related_type)}</span>
        <Button size="sm" variant="ghost" onClick={() => void dismiss(r.id)}>
          Dismiss
        </Button>
      </li>
    );
  };

  return (
    <div className="reminders-panel">
      <p className="visually-hidden" role="status" aria-live="polite">
        {status}
      </p>
      {showSkeleton ? (
        <Skeleton rows={4} />
      ) : rows.length === 0 ? (
        <p>No reminders due or upcoming.</p>
      ) : (
        <>
          {due.length > 0 && (
            <>
              <h3 className="reminders-heading">
                Due now
                <span className="reminder-count">{due.length}</span>
              </h3>
              <ul className="reminder-list">{due.map(renderRow)}</ul>
            </>
          )}
          {upcoming.length > 0 && (
            <>
              <h3 className="reminders-heading">Upcoming</h3>
              <ul className="reminder-list">{upcoming.map(renderRow)}</ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
