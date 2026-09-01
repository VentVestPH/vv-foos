import type { ReactNode } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { downloadCsv } from '../../lib/csv';

interface ListPageProps {
  title: string;
  /** Large blue outline entity icon at left (Taleo page-header pattern). */
  icon?: ReactNode;
  /** One-line descriptive text under the title (Taleo page-header pattern). */
  description?: string;
  /** Live search — filters as the user types, no "Go!" button. */
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /**
   * Optional second Taleo search row rendered directly under the main
   * `Search:` row (e.g. Candidates' First Name / Last Name fields, redesign
   * prompt section 7.2). Callers wire the fields into their own filter
   * state; omitted, nothing renders and existing callers are unaffected.
   */
  secondSearchRow?: ReactNode;
  /** Filter controls rendered in the left rail. */
  filterRail?: ReactNode;
  /** Saved-views control (dropdown + save button); modules supply their own. */
  savedViewsSlot?: ReactNode;
  /** Extra head actions (e.g. "New requisition"). */
  actions?: ReactNode;
  /** The table (usually <Table />). */
  children: ReactNode;
  /** Rows currently visible after filtering; exported as CSV. */
  exportRows?: Record<string, unknown>[];
  exportColumns?: { key: string; header: string }[];
  exportFilename?: string;
}

/**
 * Standard list layout: title + actions, live search, saved-views slot,
 * filter rail on the left, table on the right, CSV export of visible rows.
 * The export only ever holds RLS-filtered rows already on the client.
 *
 * `icon`/`description` are optional — when supplied the title row renders
 * as the Taleo entity-list page header (icon + "Entity: Home" + one-line
 * description, redesign prompt section 7.1); omitted, the header falls
 * back to the plain title row so other callers are unaffected.
 */
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
        {/* Decorative — the input already filters live as you type, so Go!
            has nothing to do; it exists only to match the Taleo search
            pattern (redesign prompt section 7.2). Not a placeholder: it
            never claims to do anything the input hasn't already done. */}
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
