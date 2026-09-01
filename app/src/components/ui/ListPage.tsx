import type { ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { downloadCsv } from '../../lib/csv';

interface ListPageProps {
  title: string;

  icon?: ReactNode;

  description?: string;

  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  secondSearchRow?: ReactNode;

  filterRail?: ReactNode;

  savedViewsSlot?: ReactNode;

  actions?: ReactNode;

  children: ReactNode;

  exportRows?: Record<string, unknown>[];
  exportColumns?: { key: string; header: string }[];
  exportFilename?: string;
}

export function ListPage({
  title,
  icon,
  description,
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  secondSearchRow,
  filterRail,
  savedViewsSlot,
  actions,
  children,
  exportRows,
  exportColumns,
  exportFilename,
}: ListPageProps) {
  return (
    <div className="list-page">
      {icon ? (
        <div className="taleo-page-header">
          <span className="taleo-page-icon">{icon}</span>
          <div className="taleo-page-header-text">
            <div className="taleo-page-header-title-row">
              <h1>{title}</h1>
              {actions}
            </div>
            {description && <p className="taleo-page-desc">{description}</p>}
          </div>
        </div>
      ) : (
        <div className="list-page-head">
          <h1>{title}</h1>
          {actions}
        </div>
      )}
      <div className="list-page-toolbar taleo-search-row">
        <span className="taleo-search-label">Search:</span>
        <div className="list-page-search">
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${title}`}
          />
        </div>
        {}
        <button type="button" className="btn btn-secondary btn-sm taleo-go-btn">
          Go!
        </button>
        {savedViewsSlot}
        {exportRows && (
          <Button
            size="sm"
            onClick={() =>
              downloadCsv(
                exportFilename ??
                  title.toLowerCase().replace(/\s+/g, '-') + '.csv',
                exportRows,
                exportColumns,
              )
            }
            disabled={exportRows.length === 0}
          >
            Export CSV
          </Button>
        )}
      </div>
      {secondSearchRow && (
        <div className="list-page-toolbar taleo-search-row taleo-second-search-row">
          {secondSearchRow}
        </div>
      )}
      <div className="list-page-body">
        {filterRail && (
          <aside className="filter-rail">
            <h2>Filters</h2>
            {filterRail}
          </aside>
        )}
        <div className="list-page-table">{children}</div>
      </div>
    </div>
  );
}
