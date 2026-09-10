import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  DATE_FORMAT_HINT,
  daysInMonth,
  firstWeekdayOfMonth,
  formatDateValue,
  longDate,
  monthTitle,
  parseDateValue,
  shiftDay,
  shiftMonth,
  todayParts,
  type DateParts,
} from './dateParts';

interface DateFieldProps {
  label?: string;
  error?: string | undefined;
  value: string;
  min?: string | undefined;
  max?: string | undefined;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  'aria-label'?: string;
  onChange?: (event: { target: { value: string; name: string } }) => void;
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PICKER_GAP = 4;
const YEAR_PAGE = 12;

function yearPageStart(year: number): number {
  return year - ((year % YEAR_PAGE) + YEAR_PAGE) % YEAR_PAGE;
}

interface PickerPlacement {
  left: number;
  top: number;
}

function placeNear(rect: DOMRect, panel: DOMRect | null): PickerPlacement {
  const width = panel?.width ?? 280;
  const height = panel?.height ?? 320;
  const below = window.innerHeight - rect.bottom - PICKER_GAP - 8;
  const useAbove = below < height && rect.top - PICKER_GAP - 8 > below;
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    top: useAbove
      ? Math.max(8, rect.top - PICKER_GAP - height)
      : rect.bottom + PICKER_GAP,
  };
}

function outOfRange(parts: DateParts, min?: string, max?: string): boolean {
  const v = formatDateValue(parts);
  if (min !== undefined && min !== '' && v < min) return true;
  if (max !== undefined && max !== '' && v > max) return true;
  return false;
}

function sameDay(a: DateParts | null, b: DateParts): boolean {
  return a !== null && a.year === b.year && a.month === b.month && a.day === b.day;
}

function rangeMessage(min?: string, max?: string): string {
  const from = min !== undefined && min !== '' ? min : null;
  const to = max !== undefined && max !== '' ? max : null;
  if (from !== null && to !== null) return `Pick a date between ${from} and ${to}.`;
  if (from !== null) return `Pick a date on or after ${from}.`;
  if (to !== null) return `Pick a date on or before ${to}.`;
  return 'That date is not allowed here.';
}

interface CalendarDialogProps {
  cursor: DateParts;
  selected: DateParts | null;
  min?: string | undefined;
  max?: string | undefined;
  titleId: string;
  onCursor: (parts: DateParts) => void;
  onChoose: (parts: DateParts) => void;
  onDismiss: () => void;
  anchor: RefObject<HTMLButtonElement | null>;
}

function CalendarDialog({
  cursor,
  selected,
  min,
  max,
  titleId,
  onCursor,
  onChoose,
  onDismiss,
  anchor,
}: CalendarDialogProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<PickerPlacement | null>(null);
  const [view, setView] = useState<'day' | 'month' | 'year'>('day');

  useLayoutEffect(() => {
    const reposition = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      setPlacement(placeNear(rect, panelRef.current?.getBoundingClientRect() ?? null));
    };
    reposition();
    window.addEventListener('resize', reposition);
    document.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [anchor, panelRef]);

  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) === true) return;
      if (anchor.current?.contains(target) === true) return;
      onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchor, onDismiss, panelRef]);

  useEffect(() => {
    if (view !== 'day') return;
    const day = gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]');
    day?.focus();
  }, [cursor.year, cursor.month, cursor.day, view]);

  const weekday = new Date(cursor.year, cursor.month, cursor.day).getDay();

  const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = (parts: DateParts) => {
      event.preventDefault();
      onCursor(parts);
    };
    if (event.key === 'ArrowRight') return move(shiftDay(cursor, 1));
    if (event.key === 'ArrowLeft') return move(shiftDay(cursor, -1));
    if (event.key === 'ArrowDown') return move(shiftDay(cursor, 7));
    if (event.key === 'ArrowUp') return move(shiftDay(cursor, -7));
    if (event.key === 'Home') return move(shiftDay(cursor, -weekday));
    if (event.key === 'End') return move(shiftDay(cursor, 6 - weekday));
    if (event.key === 'PageUp') return move(shiftMonth(cursor, event.shiftKey ? -12 : -1));
    if (event.key === 'PageDown') return move(shiftMonth(cursor, event.shiftKey ? 12 : 1));
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onChoose(cursor);
    }
  };

  const lead = firstWeekdayOfMonth(cursor.year, cursor.month);
  const total = daysInMonth(cursor.year, cursor.month);
  const cells: (DateParts | null)[] = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= total; d += 1) cells.push({ year: cursor.year, month: cursor.month, day: d });
  while (cells.length < 42) cells.push(null);

  const weeks: (DateParts | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const today = todayParts();

  return (
    <div className="date-dialog-layer">
      <div
        ref={panelRef}
        className="date-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={
          placement === null
            ? { opacity: 0, pointerEvents: 'none' }
            : { left: `${placement.left}px`, top: `${placement.top}px` }
        }
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onDismiss();
          }
        }}
      >
        <div className="date-dialog-head">
          <button
            type="button"
            className="date-nav-btn"
            aria-label={view === 'day' ? 'Previous month' : 'Previous years'}
            onClick={() =>
              view === 'day'
                ? onCursor(shiftMonth(cursor, -1))
                : onCursor({ ...cursor, year: cursor.year - (view === 'month' ? 1 : YEAR_PAGE) })
            }
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="date-dialog-scope"
            aria-label={`Choose ${view === 'day' ? 'a month' : view === 'month' ? 'a year' : 'a month'}`}
            onClick={() => setView(view === 'day' ? 'month' : view === 'month' ? 'year' : 'day')}
          >
            {view === 'year'
              ? `${yearPageStart(cursor.year)}\u2013${yearPageStart(cursor.year) + YEAR_PAGE - 1}`
              : view === 'month'
                ? String(cursor.year)
                : monthTitle(cursor.year, cursor.month)}
          </button>
          <button
            type="button"
            className="date-nav-btn"
            aria-label={view === 'day' ? 'Next month' : 'Next years'}
            onClick={() =>
              view === 'day'
                ? onCursor(shiftMonth(cursor, 1))
                : onCursor({ ...cursor, year: cursor.year + (view === 'month' ? 1 : YEAR_PAGE) })
            }
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
          <h2 className="visually-hidden" id={titleId} aria-live="polite">
            {monthTitle(cursor.year, cursor.month)}
          </h2>
        </div>
        {view === 'month' && (
          <div className="date-pick-grid" role="group" aria-label="Month">
            {MONTH_NAMES.map((name, index) => (
              <button
                key={name}
                type="button"
                className="date-pick-cell"
                aria-pressed={cursor.month === index + 1}
                onClick={() => {
                  onCursor({ ...cursor, month: index + 1, day: 1 });
                  setView('day');
                }}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        )}
        {view === 'year' && (
          <div className="date-pick-grid" role="group" aria-label="Year">
            {Array.from({ length: YEAR_PAGE }, (_, i) => yearPageStart(cursor.year) + i).map(
              (year) => (
                <button
                  key={year}
                  type="button"
                  className="date-pick-cell"
                  aria-pressed={cursor.year === year}
                  onClick={() => {
                    onCursor({ ...cursor, year, day: 1 });
                    setView('month');
                  }}
                >
                  {year}
                </button>
              ),
            )}
          </div>
        )}
        {view === 'day' && (
        <div className="date-grid" role="grid" ref={gridRef} onKeyDown={onGridKeyDown}>
          <div className="date-grid-row" role="row">
            {WEEKDAYS.map((w) => (
              <span key={w} className="date-grid-head" role="columnheader">
                {w}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div className="date-grid-row" role="row" key={`w${String(wi)}`}>
              {week.map((cell, ci) =>
                cell === null ? (
                  <span
                    className="date-cell is-empty"
                    role="gridcell"
                    key={`e${String(wi)}-${String(ci)}`}
                  />
                ) : (
                  <span
                    key={formatDateValue(cell)}
                    className="date-cell"
                    role="gridcell"
                    tabIndex={sameDay(cursor, cell) ? 0 : -1}
                    aria-selected={sameDay(selected, cell)}
                    aria-label={longDate(cell)}
                    aria-disabled={outOfRange(cell, min, max) ? true : undefined}
                    data-today={sameDay(today, cell) ? 'true' : 'false'}
                    onClick={() => onChoose(cell)}
                  >
                    {cell.day}
                  </span>
                ),
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

export function DateField({
  label,
  error,
  value,
  min,
  max,
  disabled = false,
  required = false,
  id,
  name,
  className,
  'aria-label': ariaLabel,
  onChange,
}: DateFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const titleId = `${fieldId}-month`;

  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<DateParts>(() => parseDateValue(value) ?? todayParts());
  const [invalid, setInvalid] = useState<'format' | 'range' | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setText(value);
    setInvalid(null);
    const parsed = parseDateValue(value);
    if (parsed !== null) setCursor(parsed);
  }, [value]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const emit = (next: string) => {
    onChange?.({ target: { value: next, name: name ?? '' } });
  };

  const commitText = () => {
    const raw = text.trim();
    if (raw === '') {
      setInvalid(null);
      if (value !== '') emit('');
      return;
    }
    const parsed = parseDateValue(raw);
    if (parsed === null) {
      setInvalid('format');
      return;
    }
    if (outOfRange(parsed, min, max)) {
      setInvalid('range');
      return;
    }
    setInvalid(null);
    const next = formatDateValue(parsed);
    setCursor(parsed);
    setText(next);
    if (next !== value) emit(next);
  };

  const dismiss = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const choose = (parts: DateParts) => {
    if (outOfRange(parts, min, max)) return;
    const next = formatDateValue(parts);
    setInvalid(null);
    setText(next);
    setCursor(parts);
    if (next !== value) emit(next);
    dismiss();
  };

  const selected = parseDateValue(value);
  const triggerLabel = selected === null ? 'Choose a date' : `Change date, ${longDate(selected)}`;
  const describedBy = [hintId, error !== undefined ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className={className === undefined ? 'field' : `field ${className}`}>
      {label !== undefined && (
        <label className="field-label" htmlFor={fieldId}>
          {label}
          {required && <span className="field-required"> *</span>}
        </label>
      )}
      <div className="date-field-row">
        <input
          id={fieldId}
          className="date-field-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          value={text}
          disabled={disabled}
          required={required}
          aria-label={label === undefined ? ariaLabel : undefined}
          aria-describedby={describedBy}
          aria-invalid={invalid !== null || error !== undefined ? true : undefined}
          onChange={(event) => setText(event.target.value)}
          onBlur={commitText}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitText();
            }
          }}
        />
        <button
          ref={triggerRef}
          type="button"
          className="date-field-btn"
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (open) {
              dismiss();
              return;
            }
            setCursor(parseDateValue(text) ?? parseDateValue(value) ?? todayParts());
            setOpen(true);
          }}
        >
          <CalendarDays size={20} aria-hidden="true" />
        </button>
      </div>
      <span className="visually-hidden" id={hintId}>
        {DATE_FORMAT_HINT}
      </span>
      {invalid !== null && (
        <span className="field-error-text" role="alert">
          {invalid === 'format' ? DATE_FORMAT_HINT : rangeMessage(min, max)}
        </span>
      )}
      {error !== undefined && (
        <span className="field-error-text" role="alert" id={errorId}>
          {error}
        </span>
      )}
      {open &&
        createPortal(
          <CalendarDialog
            cursor={cursor}
            selected={selected}
            min={min}
            max={max}
            titleId={titleId}
            onCursor={setCursor}
            onChoose={choose}
            onDismiss={dismiss}
            anchor={triggerRef}
          />,
          document.body,
        )}
    </div>
  );
}
