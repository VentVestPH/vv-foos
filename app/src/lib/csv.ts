function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(
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

export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(cell);
      table.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    table.push(row);
  }
  return table.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
  truncated: boolean;
}

export function csvToTable(text: string, maxRows: number): CsvTable | null {
  const table = parseCsv(text);
  const head = table[0];
  if (!head) return null;
  const header = head.map((h) => h.trim());
  const dataRows = table.slice(1, maxRows + 1);
  return {
    columns: header.filter(Boolean),
    rows: dataRows.map((r) =>
      Object.fromEntries(header.map((col, i) => [col || `col_${i}`, (r[i] ?? '').trim()])),
    ),
    truncated: table.length - 1 > maxRows,
  };
}
