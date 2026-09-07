import {
  AlignJustify,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  UserRound,
  Users,
} from 'lucide-react';
import { usePlaceholder } from '../shell/Placeholder';

const VIEWS = [
  { key: 'day', label: 'Day view', Icon: CalendarDays },
  { key: 'week', label: '7-day view', Icon: CalendarRange },
  { key: 'month', label: '31-day view', Icon: LayoutGrid },
  { key: 'person', label: 'Person view', Icon: UserRound },
  { key: 'group', label: 'Group view', Icon: Users },
  { key: 'agenda', label: 'Agenda view', Icon: AlignJustify },
];

export function CalendarViewIcons() {
  const { show } = usePlaceholder();

  return (
    <span className="fo-cal-views">
      {VIEWS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          className="fo-cal-view-btn is-placeholder"
          aria-label={label}
          title={label}
          onClick={() => show(label)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}
