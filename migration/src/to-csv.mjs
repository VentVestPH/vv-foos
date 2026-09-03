function quote(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  const lines = [header.map(quote).join(',')];
  for (const row of rows) lines.push(header.map((h) => quote(row[h])).join(','));
  return lines.join('\r\n') + '\r\n';
}

function flatten(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => flatten(v)).filter(Boolean).join('; ');
  if (typeof value === 'object') {

    if ('name' in value) return String(value.name ?? '');
    if ('id' in value) return String(value.id ?? '');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function toExportTimestamp(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(iso));
  if (!m) return String(iso ?? '');
  const [, y, mo, d, hh, mi] = m;
  let hour = Number(hh);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${mo}/${d}/${y} ${String(hour).padStart(2, '0')}:${mi} ${meridiem}`;
}

export function apiRecordToExportRow(record, fieldMap) {
  const row = {};
  for (const [exportColumn, spec] of Object.entries(fieldMap)) {
    if (typeof spec === 'function') {
      row[exportColumn] = flatten(spec(record));
      continue;
    }
    const raw = record[spec];
    row[exportColumn] = /Time$/.test(exportColumn) && raw ? toExportTimestamp(raw) : flatten(raw);
  }
  return row;
}

