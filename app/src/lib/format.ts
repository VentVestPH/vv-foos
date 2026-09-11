export const EMPTY_CELL = '—';

export const CURRENCIES = ['PHP', 'USD', 'AUD', 'NZD', 'SGD', 'EUR', 'GBP'];

const DATE_PARTS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

const TIME_PARTS: Intl.DateTimeFormatOptions = {
  ...DATE_PARTS,
  hour: '2-digit',
  minute: '2-digit',
};

function format(
  iso: string | null | undefined,
  parts: Intl.DateTimeFormatOptions,
  fallback: string,
): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, parts);
}

export function formatDate(
  iso: string | null | undefined,
  fallback = EMPTY_CELL,
): string {
  return format(iso, DATE_PARTS, fallback);
}

export function formatDateTime(
  iso: string | null | undefined,
  fallback = EMPTY_CELL,
): string {
  return format(iso, TIME_PARTS, fallback);
}

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

export function formatMoney(
  value: number | null | undefined,
  currency?: string | null,
  fallback = EMPTY_CELL,
): string {
  if (value === null || value === undefined) return fallback;
  if (currency && CURRENCY_CODE.test(currency)) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(value);
  }
  return `${currency ? currency + ' ' : ''}${value.toLocaleString()}`;
}

export function sentenceCase(value: string): string {
  const words = value.replace(/_/g, ' ').trim();
  if (words === '') return words;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
