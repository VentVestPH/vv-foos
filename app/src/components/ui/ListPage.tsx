import { useState, type ReactNode } from 'react';
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
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="list-page">
      {icon ? (
        <div className="fo-page-header">
          <span className="fo-page-icon">{icon}</span>
          <div className="fo-page-header-text">
            <div className="fo-page-header-title-row">
              <h1>{title}</h1>
              {actions}
            </div>
            {description && <p className="fo-page-desc">{description}</p>}
          </div>
        </div>
      ) : (
        <div className="list-page-head">
          <h1>{title}</h1>
          {actions}
        </div>
      )}
      <div className="list-page-toolbar fo-search-row">
        <span className="fo-search-label">Search:</span>
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
        <button type="button" className="btn btn-secondary btn-sm fo-go-btn">
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
        <div className="list-page-toolbar fo-search-row fo-second-search-row">
          {secondSearchRow}
        </div>
      )}
      {filterRail && (
        <div className="list-page-filter-toggle">
          <button
            type="button"
            className="link-btn"
            aria-expanded={filtersOpen}
            aria-controls="list-filter-rail"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            {filtersOpen ? 'Hide search options' : 'Search these records'}
          </button>
        </div>
      )}
      <div className="list-page-body">
        {filterRail && filtersOpen && (
          <aside className="filter-rail" id="list-filter-rail">
            <h2>Filters</h2>
            {filterRail}
          </aside>
        )}
        <div className="list-page-table">{children}</div>
      </div>
    </div>
  );
}
