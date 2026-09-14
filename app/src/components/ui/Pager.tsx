import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

const DEFAULT_PAGE_SIZE = 20;

export function usePagination<T>(rows: T[], pageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));

  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [page, pageCount]);

  const pageRows = useMemo(
    () => rows.slice(page * pageSize, page * pageSize + pageSize),
    [rows, page, pageSize],
  );

  return {
    page,
    setPage,
    pageCount,
    pageRows,
    pageSize,
    total: rows.length,
    from: rows.length === 0 ? 0 : page * pageSize + 1,
    to: Math.min(rows.length, (page + 1) * pageSize),
  };
}

interface PagerProps {
  from: number;
  to: number;
  total: number | null;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  totalPending?: boolean;
}

export function Pager({ from, to, total, page, pageCount, onPage, totalPending }: PagerProps) {
  const single = pageCount <= 1;
  const empty = total === 0;
  const atStart = page === 0;
  const atEnd = page >= pageCount - 1;
  const startTitle = empty
    ? 'There are no rows to page through'
    : single
      ? 'There is only one page'
      : 'You are on the first page';
  const endTitle = empty
    ? 'There are no rows to page through'
    : single
      ? 'There is only one page'
      : 'You are on the last page';
  const countLabel =
    total === null
      ? to > 0
        ? `${from}-${to}`
        : ''
      : total === 0
        ? '0 of 0'
        : `${from}-${to} of ${total}`;

  return (
    <div className="fo-pager">
      <span className="fo-pager-controls">
        <button
          type="button"
          onClick={() => onPage(0)}
          disabled={atStart}
          aria-label="First page"
          title={atStart ? startTitle : 'First page'}
        >
          <ChevronsLeft size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={atStart}
          aria-label="Previous page"
          title={atStart ? startTitle : 'Previous page'}
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
      </span>
      <span className="fo-pager-count">{countLabel}</span>
      <span className="fo-pager-controls">
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={atEnd}
          aria-label="Next page"
          title={atEnd ? endTitle : 'Next page'}
        >
          <ChevronRight size={24} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPage(pageCount - 1)}
          disabled={atEnd || totalPending === true}
          aria-label="Last page"
          title={
            totalPending === true ? 'Still counting the rows' : atEnd ? endTitle : 'Last page'
          }
        >
          <ChevronsRight size={24} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
