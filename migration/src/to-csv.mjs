function quote(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Zoho's own exports are CRLF with quoted fields, and the importer's parser is
// written for that. Emitting the same shape means the API path and the export path
// feed one importer instead of two.
export function toCsv(header, rows) {
  const lines = [header.map(quote).join(',')];
  for (const row of rows) lines.push(header.map((h) => quote(row[h])).join(','));
  return lines.join('\r\n') + '\r\n';
}

function flatten(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => flatten(v)).filter(Boolean).join('; ');
  if (typeof value === 'object') {
    // Zoho lookups come back as { id, name }. The exports carry the display value,
    // so take name and fall back to id rather than stringifying the object.
    if ('name' in value) return String(value.name ?? '');
    if ('id' in value) return String(value.id ?? '');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

// Zoho's API returns ISO-8601 with an offset. The exports use MM/DD/YYYY hh:mm AM/PM
// and the importer's parser expects that, so convert rather than teach it both.
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

export { flatten, toExportTimestamp };
