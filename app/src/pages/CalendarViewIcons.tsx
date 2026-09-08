import {
  AlignJustify,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  UserRound,
  Users,
} from 'lucide-react';
import { type CalendarView, VIEW_LABELS } from './calendarData';

const VIEWS: { key: CalendarView; Icon: typeof CalendarDays }[] = [
  { key: 'day', Icon: CalendarDays },
  { key: 'week', Icon: CalendarRange },
  { key: 'month', Icon: LayoutGrid },
  { key: 'person', Icon: UserRound },
  { key: 'group', Icon: Users },
  { key: 'agenda', Icon: AlignJustify },
];

interface CalendarViewIconsProps {
  view: CalendarView;
  onChange: (view: CalendarView) => void;
}

export function CalendarViewIcons({ view, onChange }: CalendarViewIconsProps) {
  return (
    <span className="fo-cal-views" role="group" aria-label="Calendar view">
      {VIEWS.map(({ key, Icon }) => (
        <button
          key={key}
          type="button"
          className="fo-icon-btn fo-cal-view-btn"
          aria-label={VIEW_LABELS[key]}
          aria-pressed={view === key}
          title={VIEW_LABELS[key]}
          onClick={() => onChange(key)}
        >
          <Icon size={24} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}
