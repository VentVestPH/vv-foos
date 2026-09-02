const MONTHS_31 = new Set([1, 3, 5, 7, 8, 10, 12]);

const MONTH_BY_NAME = new Map([
  ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5], ['jun', 6],
  ['jul', 7], ['aug', 8], ['sep', 9], ['sept', 9], ['oct', 10], ['nov', 11], ['dec', 12],
]);

function validDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  if (m === 2) {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return d <= (leap ? 29 : 28);
  }
  return d <= (MONTHS_31.has(m) ? 31 : 30);
}

export function parseZohoTimestamp(value) {
  if (!value) return null;
  const trimmed = value.trim();

  const iso24 = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(trimmed);
  if (iso24) {
    const y = Number(iso24[1]);
    const mo = Number(iso24[2]);
    const d = Number(iso24[3]);
    const hh = Number(iso24[4]);
    const mi = Number(iso24[5]);
    const ss = iso24[6] === undefined ? 0 : Number(iso24[6]);
    if (!validDate(y, mo, d) || hh > 23 || mi > 59 || ss > 59) return null;
    const offset = iso24[7] ? iso24[7].replace(/^([+-]\d{2})(\d{2})$/, '$1:$2') : 'Z';
    return `${iso24[1]}-${iso24[2]}-${iso24[3]}T${iso24[4]}:${iso24[5]}:${String(ss).padStart(2, '0')}${offset}`;
  }

  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})\s*(AM|PM))?$/i.exec(trimmed);
  if (!m) return null;

  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (!validDate(year, month, day)) return null;

  let hour = m[4] === undefined ? 0 : Number(m[4]);
  const minute = m[5] === undefined ? 0 : Number(m[5]);
  const meridiem = m[6]?.toUpperCase();

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  if (minute > 59) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(
    hour,
  ).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
  return iso;
}

export function parseZohoDate(value) {
  const ts = parseZohoTimestamp(value);
  return ts ? ts.slice(0, 10) : null;
}

export function parsePartialDate(value, yearSourceTimestamp) {
  if (!value) return null;
  const trimmed = value.trim();

  const full = parseZohoDate(trimmed);
  if (full) return full;

  let month = null;
  let day = null;

  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(trimmed);
  if (slash) {
    month = Number(slash[1]);
    day = Number(slash[2]);
  } else {
    const named = /^(\d{1,2})[-\s]([A-Za-z]{3,4})\.?$/.exec(trimmed);
    if (named) {
      day = Number(named[1]);
      month = MONTH_BY_NAME.get(named[2].toLowerCase()) ?? null;
    } else {
      const namedFirst = /^([A-Za-z]{3,4})\.?[-\s](\d{1,2})$/.exec(trimmed);
      if (namedFirst) {
        month = MONTH_BY_NAME.get(namedFirst[1].toLowerCase()) ?? null;
        day = Number(namedFirst[2]);
      }
    }
  }
  if (month === null || day === null) return null;

  const createdIso = parseZohoTimestamp(yearSourceTimestamp);
  if (!createdIso) return null;

  const year = Number(createdIso.slice(0, 4));
  if (!validDate(year, month, day)) return null;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseZohoBoolean(value) {
  if (value === undefined || value === null) return null;
  const v = value.trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

export function parseZohoNumber(value) {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseStarGrade(value) {
  const n = parseZohoNumber(value);
  if (n === null) return { grade: null, reason: value ? 'unparseable' : 'empty' };
  if (!Number.isInteger(n)) {
    if (Number.isInteger(Math.round(n)) && Math.abs(n - Math.round(n)) < 1e-9) {
      return gradeInRange(Math.round(n));
    }
    return { grade: null, reason: `not an integer: ${value}` };
  }
  return gradeInRange(n);
}

function gradeInRange(n) {
  if (n < 1 || n > 3) return { grade: null, reason: `outside the 1-3 range: ${n}` };
  return { grade: n, reason: null };
}

export function splitName(full) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts[parts.length - 1] };
}
