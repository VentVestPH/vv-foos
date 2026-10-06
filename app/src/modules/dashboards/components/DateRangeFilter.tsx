import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useDismissable } from '../../../hooks/useDismissable';
import {
  RANGE_PRESETS,
  isoDate,
  parseIsoDate,
  rangeForPreset,
  type DateRange,
} from '../lib';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Date(2000, month, 1).toLocaleString(undefined, { month: 'long' }),
);
const GAP = 6;
const EDGE = 8;

function formatDay(value: string): string {
  return parseIsoDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function rangeLabel(range: DateRange): string {
  if (range.preset !== 'custom') return RANGE_PRESETS.find((preset) => preset.value === range.preset)?.label ?? 'Custom range';
  if (range.from === range.to) return formatDay(range.from);
  return `${formatDay(range.from)} – ${formatDay(range.to)}`;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthCells(month: Date): (string | null)[] {
  const first = monthStart(month);
  const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(isoDate(new Date(first.getFullYear(), first.getMonth(), day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftDay(value: string, days: number): string {
  const date = parseIsoDate(value);
  return isoDate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

export function DateRangeFilter({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const today = isoDate(new Date());
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>(range);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState(() => addMonths(monthStart(new Date()), -1));
  const [focusDay, setFocusDay] = useState<string>(today);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);
  const popover = useDismissable(open, close);

  const openPicker = () => {
    setDraft(range);
    setAnchor(null);
    setHovered(null);
    setFocusDay(range.to);
    setView(addMonths(monthStart(parseIsoDate(range.to)), -1));
    setOpen(true);
  };

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const t = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.scrollHeight;
    const left = t.left + width <= window.innerWidth - EDGE ? t.left : Math.max(EDGE, t.right - width);
    const maxHeight = window.innerHeight - EDGE * 2;
    const top = Math.max(EDGE, Math.min(t.bottom + GAP, window.innerHeight - EDGE - Math.min(height, maxHeight)));
    setPosition({ left, top, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('.field-select-menu')) return;
      popover.requestClose();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place, popover]);

  useEffect(() => {
    if (!open || !position) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-day="${focusDay}"]`)?.focus({ preventScroll: true });
  }, [focusDay, open, position]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: current - 1999 }, (_, index) => current + 1 - index);
  }, []);

  const pickPreset = (preset: Exclude<DateRange['preset'], 'custom'>) => {
    const next = rangeForPreset(preset);
    setDraft(next);
    setAnchor(null);
    setFocusDay(next.to);
    setView(addMonths(monthStart(parseIsoDate(next.to)), -1));
  };

  const pickDay = (day: string) => {
    setFocusDay(day);
    if (!anchor) {
      setAnchor(day);
      setDraft({ preset: 'custom', from: day, to: day });
      return;
    }
    const [from, to] = day < anchor ? [day, anchor] : [anchor, day];
    setAnchor(null);
    setHovered(null);
    setDraft({ preset: 'custom', from, to });
  };

  const previewFrom = anchor && hovered ? (hovered < anchor ? hovered : anchor) : draft.from;
  const previewTo = anchor && hovered ? (hovered < anchor ? anchor : hovered) : draft.to;
  const showsRange = draft.preset !== 'all' || anchor !== null;

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = shiftDay(focusDay, step);
    const nextMonth = monthStart(parseIsoDate(next));
    if (nextMonth < view) setView(nextMonth);
    else if (nextMonth > addMonths(view, 1)) setView(addMonths(nextMonth, -1));
    setFocusDay(next);
    if (anchor) setHovered(next);
  };

  const apply = () => {
    onChange(draft);
    close();
  };

  const renderMonth = (month: Date, side: 'start' | 'end') => (
    <div className="dash-range-month" key={side}>
      <div className="dash-range-month-head">
        {side === 'start' ? (
          <button type="button" className="fo-icon-btn" aria-label="Previous month" title="Previous month" onClick={() => setView(addMonths(view, -1))}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
        ) : <span className="dash-range-nav-spacer" />}
        <div className="dash-range-month-pickers">
          <Select
            className="dash-range-select"
            fitMenuContent
            aria-label={side === 'start' ? 'First calendar month' : 'Second calendar month'}
            value={String(month.getMonth())}
            options={MONTHS.map((name, index) => ({ value: String(index), label: name }))}
            onChange={(event) => setView(addMonths(new Date(month.getFullYear(), Number(event.target.value), 1), side === 'start' ? 0 : -1))}
          />
          <Select
            className="dash-range-select"
            fitMenuContent
            aria-label={side === 'start' ? 'First calendar year' : 'Second calendar year'}
            value={String(month.getFullYear())}
            options={years.map((year) => ({ value: String(year), label: String(year) }))}
            onChange={(event) => setView(addMonths(new Date(Number(event.target.value), month.getMonth(), 1), side === 'start' ? 0 : -1))}
          />
        </div>
        {side === 'end' ? (
          <button type="button" className="fo-icon-btn" aria-label="Next month" title="Next month" onClick={() => setView(addMonths(view, 1))}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        ) : <span className="dash-range-nav-spacer" />}
      </div>
      <div className="dash-range-weekdays" aria-hidden="true">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="dash-range-days" role="grid" aria-label={`${MONTHS[month.getMonth()]} ${month.getFullYear()}`}>
        {monthCells(month).map((day, index) => {
          if (!day) return <span key={`blank-${index}`} className="dash-range-blank" />;
          const inRange = showsRange && day >= previewFrom && day <= previewTo;
          const isStart = showsRange && day === previewFrom;
          const isEnd = showsRange && day === previewTo;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              data-day={day}
              tabIndex={day === focusDay ? 0 : -1}
              aria-selected={isStart || isEnd}
              aria-label={parseIsoDate(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              className="dash-range-day"
              data-in-range={inRange && !isStart && !isEnd ? 'true' : undefined}
              data-edge={isStart && isEnd ? 'both' : isStart ? 'start' : isEnd ? 'end' : undefined}
              data-today={day === today ? 'true' : undefined}
              onClick={() => pickDay(day)}
              onMouseEnter={() => { if (anchor) setHovered(day); }}
            >
              <span>{parseIsoDate(day).getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="dash-daterange">
      <button
        ref={triggerRef}
        type="button"
        className="dash-range-trigger"
        aria-label="Date range"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? popover.requestClose() : openPicker())}
      >
        <CalendarRange size={20} aria-hidden="true" />
        <span className="dash-range-trigger-label">{rangeLabel(range)}</span>
        <ChevronDown size={20} aria-hidden="true" className="dash-range-caret" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="dash-range-pop"
          role="dialog"
          aria-label="Choose a date range"
          data-closing={popover.closing ? 'true' : undefined}
          style={position ? { left: `${position.left}px`, top: `${position.top}px`, maxHeight: `${position.maxHeight}px` } : { visibility: 'hidden' }}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && !event.defaultPrevented) {
              event.preventDefault();
              event.stopPropagation();
              popover.requestClose();
            }
          }}
        >
          <div className="dash-range-body">
            <div className="dash-range-presets" role="group" aria-label="Quick ranges">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className="dash-range-preset"
                  aria-pressed={draft.preset === preset.value}
                  onClick={() => pickPreset(preset.value)}
                >
                  {preset.label}
                </button>
              ))}
              <span className="dash-range-preset dash-range-preset-custom" aria-hidden={draft.preset !== 'custom'} data-active={draft.preset === 'custom' ? 'true' : undefined}>
                Custom range
              </span>
            </div>
            <div className="dash-range-calendars" onKeyDown={onGridKeyDown} onMouseLeave={() => setHovered(null)}>
              {renderMonth(view, 'start')}
              {renderMonth(addMonths(view, 1), 'end')}
            </div>
          </div>
          <div className="dash-range-foot">
            <div className="dash-range-summary">
              <div className="dash-range-field">
                <span>From</span>
                <strong>{draft.preset === 'all' ? 'Beginning' : formatDay(draft.from)}</strong>
              </div>
              <ChevronRight size={20} aria-hidden="true" className="dash-range-arrow" />
              <div className="dash-range-field">
                <span>To</span>
                <strong>{anchor ? 'Pick an end date' : formatDay(draft.to)}</strong>
              </div>
            </div>
            <div className="dash-range-actions">
              <Button type="button" onClick={() => popover.requestClose()}>Cancel</Button>
              <Button type="button" variant="primary" disabled={anchor !== null} title={anchor ? 'Pick an end date first' : undefined} onClick={apply}>
                Apply
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
