import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;

  header: ReactNode;
  sortable?: boolean;

  sortValue?: (row: T) => string | number | null;

  render?: (row: T) => ReactNode;

  capped?: boolean;
  width?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;

  zebra?: boolean;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  busy?: boolean;

  sortKey?: string | null;
  sortDir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
}

type SortDir = 'asc' | 'desc';

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
  busy,
  sortKey: controlledKey,
  sortDir: controlledDir,
  onSortChange,
}: TableProps<T>) {
  const controlled = onSortChange !== undefined;
  const [internalKey, setInternalKey] = useState<string | null>(null);
  const [internalDir, setInternalDir] = useState<SortDir>('asc');
  const sortKey = controlled ? (controlledKey ?? null) : internalKey;
  const sortDir = controlled ? (controlledDir ?? 'asc') : internalDir;
  const [internalSelected, setInternalSelected] = useState<Set<string>>(
    new Set(),
  );
  const sel = selected ?? internalSelected;

  const setSelection = (next: Set<string>) => {
    if (!selected) setInternalSelected(next);
    onSelectionChange?.(next);
  };

  const sorted = useMemo(() => {
    if (controlled) return rows;
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
  }, [rows, columns, sortKey, sortDir, controlled]);

  const toggleSort = (key: string) => {
    const nextDir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    if (controlled) {
      onSortChange(key, nextDir);
      return;
    }
    setInternalKey(key);
    setInternalDir(nextDir);
  };

  const allSelected = rows.length > 0 && rows.every((r) => sel.has(rowKey(r)));

  const toggleAll = () => {
    setSelection(allSelected ? new Set() : new Set(rows.map(rowKey)));
  };

  const signature = `${sorted.length}:${sorted.length ? rowKey(sorted[0]) : ''}`;
  const lastSignature = useRef(signature);
  const [resultsPulse, setResultsPulse] = useState(0);

  useEffect(() => {
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    setResultsPulse((n) => n + 1);
  }, [signature]);

  const resultsClass =
    resultsPulse === 0
      ? undefined
      : resultsPulse % 2 === 1
        ? 'results-in-a'
        : 'results-in-b';

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const takeFocus = useRef(false);

  useEffect(() => {
    if (activeIndex < 0 || !takeFocus.current) return;
    takeFocus.current = false;
    const rowEls = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[data-row-key]');
    rowEls?.[Math.min(activeIndex, rowEls.length - 1)]?.focus();
  }, [activeIndex, sorted]);

  const goToRow = (index: number) => {
    takeFocus.current = true;
    setActiveIndex(index);
  };

  const moveActive = (delta: number, from?: number) => {
    const last = sorted.length - 1;
    if (last < 0) return;
    const base = from ?? activeIndex;
    goToRow(base < 0 ? (delta > 0 ? 0 : last) : Math.min(last, Math.max(0, base + delta)));
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    const key = event.key;
    if (key === 'ArrowDown' || key === 'j') {
      event.preventDefault();
      moveActive(1, index);
    } else if (key === 'ArrowUp' || key === 'k') {
      event.preventDefault();
      moveActive(-1, index);
    } else if (key === 'Home') {
      event.preventDefault();
      goToRow(0);
    } else if (key === 'End') {
      event.preventDefault();
      goToRow(sorted.length - 1);
    } else if (key === 'Enter') {
      if (!onRowClick) return;
      event.preventDefault();
      onRowClick(row);
    } else if (key === ' ' || key === 'x') {
      if (!selectable) return;
      event.preventDefault();
      toggleRow(rowKey(row));
    }
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
      <table className={zebra ? 'table zebra' : 'table'} aria-busy={busy || undefined}>
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
        <tbody className={resultsClass} ref={tbodyRef}>
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
          {sorted.map((row, index) => {
            const key = rowKey(row);
            return (
              <tr
                key={key}
                data-row-key={key}
                tabIndex={index === Math.max(activeIndex, 0) ? 0 : -1}
                aria-selected={selectable ? sel.has(key) : undefined}
                onKeyDown={(e) => onRowKeyDown(e, index, row)}
                onFocus={() => setActiveIndex(index)}
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
