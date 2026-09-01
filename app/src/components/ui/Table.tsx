import { useMemo, useState, type ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  /** Usually plain text; icon-only decorative headers (e.g. Taleo's flag
   *  column) may pass a ReactNode instead. */
  header: ReactNode;
  sortable?: boolean;
  /** Value used for sorting; defaults to row[key]. */
  sortValue?: (row: T) => string | number | null;
  /** Cell renderer; defaults to String(row[key]). */
  render?: (row: T) => ReactNode;
  /** Cap long text at two lines with expand-on-click. */
  capped?: boolean;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Adds a leading checkbox column and reports selected row keys. */
  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  /** Alternating row background. On by default — Taleo tables are subtly
   *  zebra-striped throughout (redesign default; the original ATS brief
   *  had this off by default). */
  zebra?: boolean;
  onRowClick?: (row: T) => void;
  emptyText?: string;
}

type SortDir = 'asc' | 'desc';

/** Two-line text cap with expand-on-click (architecture section 7). */
export function CappedCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <div
      className={expanded ? 'cell-expanded' : 'cell-capped'}
      title={expanded ? 'Click to collapse' : 'Click to expand'}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
    >
      {text}
    </div>
  );
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  selectable = false,
  selected,
  onSelectionChange,
  zebra = true,
  onRowClick,
  emptyText = 'No records.',
}: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set(),
  );
  const sel = selected ?? internalSelected;

  const setSelection = (next: Set<string>) => {
    if (!selected) setInternalSelected(next);
    onSelectionChange?.(next);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const value = (row: T): string | number =>
      col.sortValue
        ? (col.sortValue(row) ?? '')
        : String((row as Record<string, unknown>)[col.key] ?? '');
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * dir;
      }
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allSelected = rows.length > 0 && rows.every((r) => sel.has(rowKey(r)));

  const toggleAll = () => {
    setSelection(allSelected ? new Set() : new Set(rows.map(rowKey)));
  };

  const toggleRow = (key: string) => {
    const next = new Set(sel);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelection(next);
  };

  return (
    <div className="table-wrap">
      <table className={zebra ? 'table zebra' : 'table'}>
        <thead>
          <tr>
            {selectable && (
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                className={col.sortable ? 'sortable' : undefined}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {col.header}
                {col.sortable && sortKey === col.key && (
                  <span className="sort-arrow">
                    {sortDir === 'asc' ? '▲' : '▼'}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td
                className="table-empty"
                colSpan={columns.length + (selectable ? 1 : 0)}
              >
                {emptyText}
              </td>
            </tr>
          )}
          {sorted.map((row) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {selectable && (
                  <td
                    className="checkbox-col"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={sel.has(key)}
                      onChange={() => toggleRow(key)}
                      aria-label="Select row"
                    />
                  </td>
                )}
                {columns.map((col) => {
                  const raw = (row as Record<string, unknown>)[col.key];
                  return (
                    <td key={col.key}>
                      {col.render ? (
                        col.render(row)
                      ) : col.capped ? (
                        <CappedCell text={raw == null ? '' : String(raw)} />
                      ) : raw == null ? (
                        ''
                      ) : (
                        String(raw)
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
