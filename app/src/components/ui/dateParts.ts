export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export const DATE_FORMAT_HINT = 'Use the format YYYY-MM-DD, for example 2026-09-07';

export function todayParts(): DateParts {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export function parseDateValue(value: string): DateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (m === null) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const probe = new Date(year, month, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month || probe.getDate() !== day) {
    return null;
  }
  return { year, month, day };
}

export function formatDateValue(parts: DateParts): string {
  const mm = String(parts.month + 1).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function shiftDay(
  parts: DateParts,
  days: number,
): DateParts {
  const d = new Date(parts.year, parts.month, parts.day + days);
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export function shiftMonth(
  parts: DateParts,
  months: number,
): DateParts {
  const target = new Date(parts.year, parts.month + months, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  return { year, month, day: Math.min(parts.day, daysInMonth(year, month)) };
}

export function longDate(parts: DateParts): string {
  return new Date(parts.year, parts.month, parts.day).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
