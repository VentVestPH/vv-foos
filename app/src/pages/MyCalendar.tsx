import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { relatedHref, relatedLabel } from '../lib/relatedLink';
import { supabase } from '../lib/supabase';
import { CalendarViewIcons } from './CalendarViewIcons';
import { MiniCalendar } from './MiniCalendar';
import { NewCalendarEntryDialog } from './NewCalendarEntryDialog';
import { useMinimumVisible } from '../hooks/useMinimumVisible';
import {
  type CalendarEntry,
  type CalendarView,
  loadCalendar,
  rangeFor,
} from './calendarData';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrators',
  recruiter: 'Recruiters',
  sourcer: 'Sourcers',
  bd: 'Business Development',
};

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function dayStamp(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MyCalendar() {
  const { staff } = useSession();
  const navigate = useNavigate();
  const [view, setView] = useState<CalendarView>('day');
  const [anchor] = useState(() => new Date());
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<'event' | 'task' | 'interview' | null>(null);
  const [staffNames, setStaffNames] = useState<Map<string, { name: string; role: string }>>(
    new Map(),
  );

  const showSkeleton = useMinimumVisible(loading);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await loadCalendar(range));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the calendar.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('staff')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => {
        if (cancelled) return;
        setStaffNames(
          new Map(
            (data ?? []).map((r) => [
              r.id as string,
              { name: r.full_name as string, role: r.role as string },
            ]),
          ),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayLabel = anchor.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const [rangeLead, rangeDetail] =
    view === 'day'
      ? ['Today', todayLabel]
      : view === 'week'
        ? ['Week of', range.from.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })]
        : view === 'month'
          ? ['Month of', range.from.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })]
          : [
              'Next 30 days',
              `from ${range.from.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`,
            ];

  const entryRow = (e: CalendarEntry) => {
    const href = relatedHref(e.relatedType, e.relatedId);
    return (
      <li key={e.id} className="task-row" data-kind={e.kind}>
        <span className="task-due">{whenLabel(e.at)}</span>
        <span className="task-subject">
          {href ? (
            <button type="button" className="link-btn" onClick={() => navigate(href)}>
              {e.subject}
            </button>
          ) : (
            e.subject
          )}
        </span>
        <span className="task-related">{e.kind}</span>
        <span className="task-related">
          {e.relatedType ? relatedLabel(e.relatedType) : ''}
        </span>
      </li>
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      let key: string;
      if (view === 'person') {
        key = e.ownerId ? (staffNames.get(e.ownerId)?.name ?? 'Unassigned') : 'Unassigned';
      } else if (view === 'group') {
        const role = e.ownerId ? staffNames.get(e.ownerId)?.role : undefined;
        key = role ? (ROLE_LABELS[role] ?? role) : 'Unassigned';
      } else {
        key = dayStamp(e.at);
      }
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [entries, view, staffNames]);

  const body = () => {
    if (showSkeleton) return <Skeleton rows={6} />;
    if (error) {
      return (
        <p className="form-error" role="alert">
          {error}
        </p>
      );
    }
    if (entries.length === 0) {
      return <p>No events scheduled{view === 'day' ? '' : ' in this range'}.</p>;
    }
    if (view === 'day') return <ul className="task-list">{entries.map(entryRow)}</ul>;
    if (view === 'month') {
      return (
        <ul className="fo-cal-month">
          {grouped.map(([key, list]) => (
            <li key={key} className="fo-cal-month-cell">
              <span className="fo-cal-month-day">
                {new Date(`${key}T00:00:00`).getDate()}
              </span>
              <span className="fo-cal-month-count">
                {list.length} {list.length === 1 ? 'entry' : 'entries'}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="fo-cal-groups">
        {grouped.map(([key, list]) => (
          <section key={key} className="fo-cal-group">
            <h4 className="fo-cal-group-title">
              {view === 'person' || view === 'group' ? key : dateLabel(`${key}T00:00:00`)}
              <span className="fo-cal-group-count">{list.length}</span>
            </h4>
            <ul className="task-list">{list.map(entryRow)}</ul>
          </section>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="fo-calendar-body">
        <div className="fo-calendar-main">
          <div className="record-section-inline-actions">
            <Button size="sm" variant="primary" onClick={() => setCreating('event')}>
              New Event
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCreating('interview')}>
              Schedule interview
            </Button>
            <CalendarViewIcons view={view} onChange={setView} />
          </div>
          <div className="fo-calendar-toolbar">
            <p className="fo-calendar-when">
              <span className="fo-calendar-when-lead">{rangeLead}</span>
              <span className="fo-calendar-when-date">{rangeDetail}</span>
            </p>
          </div>
          {body()}
        </div>
        <MiniCalendar />
      </div>
      {creating && (
        <NewCalendarEntryDialog
          mode={creating}
          staffId={staff?.id ?? null}
          onClose={() => setCreating(null)}
          onSaved={() => {
            setCreating(null);
            void load();
          }}
        />
      )}
    </>
  );
}
