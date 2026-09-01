// Client-side CSV export of rows already held in memory. Because rows arrive
// through RLS-filtered queries, the export can never contain more than the
// user is allowed to read.

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns?: { key: string; header: string }[],
): string {
  if (rows.length === 0) return '';
  const cols =
    columns ?? Object.keys(rows[0]).map((k) => ({ key: k, header: k }));
  const head = cols.map((c) => escapeCell(c.header)).join(',');
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c.key])).join(','))
    .join('\n');
  return head + '\n' + body;
}

export function downloadCsv(
  filename: string,
  rows: Record<string, unknown>[],
  columns?: { key: string; header: string }[],
): void {
  const blob = new Blob([toCsv(rows, columns)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
