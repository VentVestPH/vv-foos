import { isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Inbox } from 'lucide-react';
import { EMPTY_CELL } from '../../lib/format';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import { Pager } from './Pager';

export interface TableColumn<T> {
  key: string;

  header: ReactNode;

  sortValue?: (row: T) => string | number | null;

  render?: (row: T) => ReactNode;

  capped?: boolean;
  width?: string;
  minWidth?: string;
  nowrap?: boolean;
  align?: 'center';

  hideWhenEmpty?: boolean;
}

interface TableProps<T> {
  className?: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowName?: (row: T) => string;

  selectable?: boolean;
  selected?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;

  zebra?: boolean;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  busy?: boolean;

  emptyIcon?: ReactNode;

  sortKey?: string | null;
  sortDir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;

  pageSize?: number;
}

type SortDir = 'asc' | 'desc';

function renderedText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(value)) return renderedText(value.props.children);
  return '';
}

export function CappedCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      className={expanded ? 'cell-expanded' : 'cell-capped'}
      aria-expanded={expanded}
      title={expanded ? 'Collapse' : 'Expand'}
      onClick={(e) => {
        e.stopPropagation();
        setExpanded((v) => !v);
      }}
    >
      {text}
    </button>
  );
}

export function Table<T>({
  className,
  columns,
  rows,
  rowKey,
  rowName,
  selectable = false,
  selected,
  onSelectionChange,
  zebra = true,
  onRowClick,
  emptyText = 'No records.',
  busy,
  emptyIcon,
  sortKey: controlledKey,
  sortDir: controlledDir,
  onSortChange,
  pageSize,
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

  const visibleColumns = useMemo(() => {
    if (rows.length === 0) return columns;
    return columns.filter((col) => {
      if (col.hideWhenEmpty !== true) return true;
      return rows.some((row) => {
        const value = col.sortValue
          ? col.sortValue(row)
          : (row as Record<string, unknown>)[col.key];
        if (value === null || value === undefined) return false;
        const text = String(value).trim();
        return text !== '' && text !== EMPTY_CELL;
      });
    });
  }, [columns, rows]);

  const setSelection = (next: Set<string>) => {
    if (!selected) setInternalSelected(next);
    onSelectionChange?.(next);
  };

  const sorted = useMemo(() => {
    if (controlled) return rows;
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const value = (row: T): string | number => {
      if (col.sortValue) return col.sortValue(row) ?? '';
      const raw = (row as Record<string, unknown>)[col.key];
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'boolean') return raw ? 1 : 0;
      return col.render ? renderedText(col.render(row)) : '';
    };
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

  const [page, setPage] = useState(0);
  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount - 1);

  useEffect(() => {
    setPage(0);
  }, [sortKey, sortDir]);

  const displayed = useMemo(
    () => (pageSize ? sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize) : sorted),
    [currentPage, pageSize, sorted],
  );

  const toggleSort = (key: string) => {
    const nextDir: SortDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    if (controlled) {
      onSortChange(key, nextDir);
      return;
    }
    setInternalKey(key);
    setInternalDir(nextDir);
  };

  const selectableRows = pageSize ? displayed : rows;
  const selectedOnPage = selectableRows.filter((r) => sel.has(rowKey(r))).length;
  const allSelected = selectableRows.length > 0 && selectedOnPage === selectableRows.length;
  const someSelected = selectedOnPage > 0 && selectedOnPage < selectableRows.length;
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectAllRef.current !== null) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = () => {
    setSelection(allSelected ? new Set() : new Set(selectableRows.map(rowKey)));
  };

  const signature = `${displayed.length}:${displayed.length ? rowKey(displayed[0]) : ''}`;
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
  }, [activeIndex, displayed]);

  const goToRow = (index: number) => {
    takeFocus.current = true;
    setActiveIndex(index);
  };

  const moveActive = (delta: number, from?: number) => {
    const last = displayed.length - 1;
    if (last < 0) return;
    const base = from ?? activeIndex;
    goToRow(base < 0 ? (delta > 0 ? 0 : last) : Math.min(last, Math.max(0, base + delta)));
  };

  const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, index: number, row: T) => {
    if (event.target !== event.currentTarget) return;
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
      goToRow(displayed.length - 1);
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

  const table = (
    <div className={['table-wrap', className].filter(Boolean).join(' ')}>
      <table className={zebra ? 'table zebra' : 'table'} aria-busy={busy || undefined}>
        <thead>
          <tr>
            {selectable && (
              <th className="checkbox-col">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={
                    someSelected
                      ? `Select all rows, ${selectedOnPage} of ${selectableRows.length} selected`
                      : 'Select all rows'
                  }
                />
              </th>
            )}
            {visibleColumns.map((col) => {
              return (
              <th
                key={col.key}
                className={
                  ['sortable', col.align === 'center' ? 'cell-center' : '']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                style={
                  col.width || col.minWidth
                    ? {
                        ...(col.width ? { width: col.width } : {}),
                        ...(col.minWidth ? { minWidth: col.minWidth } : {}),
                      }
                    : undefined
                }
                aria-sort={
                  sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                <button
                    type="button"
                    className="th-sort-btn"
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.header}
                    <span
                      className="sort-arrow"
                      data-active={sortKey === col.key ? 'true' : 'false'}
                      data-dir={sortKey === col.key ? sortDir : 'desc'}
                      aria-hidden="true"
                    >
                      <ChevronDown size={20} />
                    </span>
                  </button>
              </th>
              );
            })}
          </tr>
        </thead>
        <tbody className={resultsClass} ref={tbodyRef}>
          {displayed.length === 0 && (
            <tr>
              <td
                className="table-empty"
                colSpan={visibleColumns.length + (selectable ? 1 : 0)}
              >
                {busy === true ? (
                  <Skeleton rows={5} label="Loading rows" />
                ) : (
                  <EmptyState
                    compact
                    icon={emptyIcon ?? <Inbox size={32} />}
                    title={emptyText}
                  />
                )}
              </td>
            </tr>
          )}
          {displayed.map((row, index) => {
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
                      aria-label={
                        rowName !== undefined ? `Select ${rowName(row)}` : 'Select row'
                      }
                    />
                  </td>
                )}
                {visibleColumns.map((col) => {
                  const raw = (row as Record<string, unknown>)[col.key];
                  return (
                    <td
                      key={col.key}
                      className={
                        [col.nowrap ? 'cell-nowrap' : '', col.align === 'center' ? 'cell-center' : '']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                    >
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

  if (!pageSize) return table;
  return (
    <div className="fo-table-paged">
      <div className="fo-list-toolbar">
        <Pager
          from={sorted.length === 0 ? 0 : currentPage * pageSize + 1}
          to={Math.min(sorted.length, (currentPage + 1) * pageSize)}
          total={sorted.length}
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
        />
      </div>
      {table}
    </div>
  );
}
