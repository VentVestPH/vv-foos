import { useEffect, useMemo, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 20;

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
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

export function Pager({ from, to, total, page, pageCount, onPage }: PagerProps) {
  const atStart = page === 0;
  const atEnd = page >= pageCount - 1;

  return (
    <div className="fo-pager">
      {pageCount > 1 && (
        <span className="fo-pager-controls">
          <button type="button" onClick={() => onPage(0)} disabled={atStart} aria-label="First page">
            &laquo;
          </button>
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={atStart}
            aria-label="Previous page"
          >
            &lsaquo;
          </button>
        </span>
      )}
      <span className="fo-pager-count">
        {total === 0 ? '0 of 0' : `${from}-${to} of ${total}`}
      </span>
      {pageCount > 1 && (
        <span className="fo-pager-controls">
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={atEnd}
            aria-label="Next page"
          >
            &rsaquo;
          </button>
          <button
            type="button"
            onClick={() => onPage(pageCount - 1)}
            disabled={atEnd}
            aria-label="Last page"
          >
            &raquo;
          </button>
          <span className="fo-pager-pos" aria-live="polite">
            {page + 1} / {pageCount}
          </span>
        </span>
      )}
    </div>
  );
}
