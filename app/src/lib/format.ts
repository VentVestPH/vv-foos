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

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? m);
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

export function htmlToText(value: string): string {
  if (!looksLikeHtml(value)) return value;
  return decodeEntities(
    value
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '• ')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}
