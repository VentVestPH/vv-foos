import { useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityKind } from '../../lib/database.types';

export interface TimelineItem {
  id: string;
  kind: ActivityKind;
  subject: string | null;
  body?: string | null;
  occurred_at: string;

  meta?: ReactNode;
}

const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  email: Mail,
  call: Phone,
  meeting: CalendarDays,
  inmail: Send,
  note: Pencil,
  status_change: ArrowLeftRight,
  system: Settings,
};

const KIND_LABELS: Record<ActivityKind, string> = {
  email: 'Email',
  call: 'Call',
  meeting: 'Meeting',
  inmail: 'InMail',
  note: 'Note',
  status_change: 'Status change',
  system: 'System',
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const INITIAL_VISIBLE = 50;
const MORE_STEP = 100;

export function Timeline({ items }: { items: TimelineItem[] }) {
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  if (items.length === 0) {
    return <div className="timeline-empty">No activity yet.</div>;
  }

  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
  const shown = sorted.slice(0, visible);
  const hidden = sorted.length - shown.length;

  const groups: { label: string; items: TimelineItem[] }[] = [];
  for (const item of shown) {
    const label = dayLabel(item.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) {
      last.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return (
    <div className="timeline">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="timeline-day-label">{group.label}</div>
          {group.items.map((item) => (
            <div key={item.id} className="timeline-item">
              <span
                className="timeline-icon"
                role="img"
                title={KIND_LABELS[item.kind]}
                aria-label={KIND_LABELS[item.kind]}
              >
                {(() => {
                  const Icon = KIND_ICONS[item.kind];
                  return <Icon size={20} aria-hidden="true" />;
                })()}
              </span>
              <div className="timeline-body">
                <span className="timeline-subject">
                  {item.subject ?? KIND_LABELS[item.kind]}
                </span>
                {item.body && <p className="timeline-text">{item.body}</p>}
              </div>
              <span className="timeline-meta">
                {new Date(item.occurred_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {item.meta && <> · {item.meta}</>}
              </span>
            </div>
          ))}
        </div>
      ))}
      {hidden > 0 && (
        <div className="timeline-more">
          <button type="button" className="link-btn" onClick={() => setVisible((v) => v + MORE_STEP)}>
            Show {Math.min(hidden, MORE_STEP)} earlier {hidden === 1 ? 'entry' : 'entries'}
          </button>
          <span className="text-secondary">
            Showing {shown.length} of {sorted.length}
          </span>
        </div>
      )}
    </div>
  );
}
