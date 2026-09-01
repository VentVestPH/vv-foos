// Shared helpers for the CRM (sales) module. Reads only the Gate 1 types —
// no candidate-shaped types are imported anywhere in this module.

import type {
  Json,
  PersonEmail,
  PersonPhone,
  Tables,
} from '../../lib/database.types';

export type Person = Tables<'people'>;
export type Company = Tables<'companies'>;
export type ContactProfile = Tables<'contact_profiles'>;
export type Deal = Tables<'deals'>;
export type Ticket = Tables<'tickets'>;
export type Activity = Tables<'activities'>;
export type TaskRow = Tables<'tasks'>;
export type Reminder = Tables<'reminders'>;
export type Attachment = Tables<'attachments'>;
export type Staff = Tables<'staff'>;

/** Display name from a people row. */
export function personName(
  p: Pick<Person, 'first_name' | 'last_name'> | null | undefined,
): string {
  if (!p) return '(unknown)';
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
  return name || '(no name)';
}

/** Parse the people.emails jsonb array defensively. */
export function emailList(emails: Json): PersonEmail[] {
  if (!Array.isArray(emails)) return [];
  return emails.filter(
    (e): e is { type: string; address: string } =>
      typeof e === 'object' &&
      e !== null &&
      typeof (e as Record<string, unknown>).address === 'string',
  );
}

/** Parse the people.phones jsonb array defensively. */
export function phoneList(phones: Json): PersonPhone[] {
  if (!Array.isArray(phones)) return [];
  return phones.filter(
    (p): p is { type: string; number: string } =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as Record<string, unknown>).number === 'string',
  );
}

export function primaryEmail(p: Person): string {
  return emailList(p.emails)[0]?.address ?? '';
}

export function primaryPhone(p: Person): string {
  return phoneList(p.phones)[0]?.number ?? '';
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** "City, State, Country" with the blanks dropped. */
export function locationLabel(row: {
  city: string | null;
  state: string | null;
  country: string | null;
}): string {
  return [row.city, row.state, row.country].filter(Boolean).join(', ');
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function fmtMoney(
  value: number | null,
  currency: string | null,
): string {
  if (value === null || value === undefined) return '—';
  if (currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      // Unknown currency code — fall through to the plain format.
    }
  }
  return `${currency ? currency + ' ' : ''}${value.toLocaleString()}`;
}

/** Currencies the BD team quotes in. Free-form values migrate as-is. */
export const CURRENCIES = ['PHP', 'USD', 'AUD', 'NZD', 'SGD', 'EUR', 'GBP'];

export const TASK_PRIORITIES = ['low', 'normal', 'high'];

/** lead → Lead, phone_screen → Phone screen. */
export function stageLabel(stage: string): string {
  const s = stage.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Local date (yyyy-mm-dd) for date-input defaults. */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
