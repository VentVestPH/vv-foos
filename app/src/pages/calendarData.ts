import { supabase } from '../lib/supabase';

export type CalendarView = 'day' | 'week' | 'month' | 'person' | 'group' | 'agenda';

export interface CalendarEntry {
  id: string;
  kind: 'meeting' | 'call' | 'email' | 'task' | 'reminder';
  subject: string;
  at: string;
  ownerId: string | null;
  relatedType: string | null;
  relatedId: string | null;
}

export interface CalendarRange {
  from: Date;
  to: Date;
}

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: 'Day view',
  week: '7-day view',
  month: '31-day view',
  person: 'Person view',
  group: 'Group view',
  agenda: 'Agenda view',
};

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function rangeFor(view: CalendarView, anchor: Date): CalendarRange {
  const from = startOfDay(anchor);
  const to = new Date(from);
  if (view === 'week') {
    from.setDate(from.getDate() - from.getDay());
    to.setTime(from.getTime());
    to.setDate(to.getDate() + 7);
    return { from, to };
  }
  if (view === 'month') {
    from.setDate(1);
    to.setTime(from.getTime());
    to.setMonth(to.getMonth() + 1);
    return { from, to };
  }
  if (view === 'agenda' || view === 'person' || view === 'group') {
    to.setDate(to.getDate() + 30);
    return { from, to };
  }
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export async function loadCalendar(range: CalendarRange): Promise<CalendarEntry[]> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const [activities, tasks, reminders] = await Promise.all([
    supabase
      .from('activities')
      .select(
        'id, kind, subject, occurred_at, created_by, person_id, application_id, deal_id, company_id, requisition_id',
      )
      .in('kind', ['meeting', 'call', 'email'])
      .gte('occurred_at', fromIso)
      .lt('occurred_at', toIso)
      .order('occurred_at', { ascending: true })
      .limit(400),
    supabase
      .from('tasks')
      .select('id, subject, due_date, assignee_id, related_type, related_id, status')
      .not('due_date', 'is', null)
      .gte('due_date', fromDate)
      .lt('due_date', toDate)
      .order('due_date', { ascending: true })
      .limit(400),
    supabase
      .from('reminders')
      .select('id, subject, remind_at, staff_id, related_type, related_id, status')
      .gte('remind_at', fromIso)
      .lt('remind_at', toIso)
      .order('remind_at', { ascending: true })
      .limit(400),
  ]);

  const out: CalendarEntry[] = [];

  for (const a of activities.data ?? []) {
    const relatedType = a.person_id
      ? 'person'
      : a.application_id
        ? 'application'
        : a.deal_id
          ? 'deal'
          : a.company_id
            ? 'company'
            : a.requisition_id
              ? 'requisition'
              : null;
    const relatedId =
      a.person_id ?? a.application_id ?? a.deal_id ?? a.company_id ?? a.requisition_id ?? null;
    out.push({
      id: `activity:${a.id}`,
      kind: a.kind as CalendarEntry['kind'],
      subject: a.subject ?? '(no subject)',
      at: a.occurred_at as string,
      ownerId: (a.created_by as string | null) ?? null,
      relatedType,
      relatedId: relatedId as string | null,
    });
  }

  for (const t of tasks.data ?? []) {
    out.push({
      id: `task:${t.id}`,
      kind: 'task',
      subject: t.subject,
      at: `${t.due_date as string}T09:00:00.000Z`,
      ownerId: (t.assignee_id as string | null) ?? null,
      relatedType: (t.related_type as string | null) ?? null,
      relatedId: (t.related_id as string | null) ?? null,
    });
  }

  for (const r of reminders.data ?? []) {
    out.push({
      id: `reminder:${r.id}`,
      kind: 'reminder',
      subject: r.subject,
      at: r.remind_at as string,
      ownerId: (r.staff_id as string | null) ?? null,
      relatedType: (r.related_type as string | null) ?? null,
      relatedId: (r.related_id as string | null) ?? null,
    });
  }

  return out.sort((a, b) => a.at.localeCompare(b.at));
}
