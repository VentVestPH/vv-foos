import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDismissable } from '../../hooks/useDismissable';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { Button } from './Button';
import { Input } from './Input';
import { downloadCsv } from '../../lib/csv';

interface ListPageFiltersApi {
  filtersOpen: boolean;
  openFilters: (options?: { focusColumns?: boolean }) => void;
}

const ListPageFiltersContext = createContext<ListPageFiltersApi | null>(null);

export function useListPageFilters(): ListPageFiltersApi {
  const api = useContext(ListPageFiltersContext);
  if (!api) throw new Error('useListPageFilters requires a ListPage ancestor');
  return api;
}

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

  exportRows?: Record<string, unknown>[] | (() => Promise<Record<string, unknown>[]>);
  exportCount?: number;
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
  exportCount,
  exportColumns,
  exportFilename,
}: ListPageProps) {
  const [exporting, setExporting] = useState(false);
  useDocumentTitle(title);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);
  const filters = useDismissable(filtersOpen, closeFilters);
  const searchRef = useRef<HTMLInputElement>(null);
  const [columnFocusRequest, setColumnFocusRequest] = useState(0);

  const openFilters = useCallback((options?: { focusColumns?: boolean }) => {
    setFiltersOpen(true);
    if (options?.focusColumns) setColumnFocusRequest((n) => n + 1);
  }, []);

  const filtersApi = useMemo<ListPageFiltersApi>(
    () => ({ filtersOpen, openFilters }),
    [filtersOpen, openFilters],
  );

  useEffect(() => {
    if (columnFocusRequest === 0 || !filtersOpen) return;
    const rail = document.getElementById('list-filter-rail');
    const first = rail?.querySelector<HTMLInputElement>(
      '.checkbox-list input[type="checkbox"]',
    );
    first?.focus();
  }, [columnFocusRequest, filtersOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <ListPageFiltersContext.Provider value={filtersApi}>
    <div className="list-page">
      <div className="fo-page-head">
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
      <p className="visually-hidden" id="list-keyboard-help">
        Press slash to search. In the results, j or down arrow moves to the next row, k or up arrow
        to the previous one, Enter opens the record, and space or x selects it.
      </p>
      <div className="list-page-toolbar fo-search-row">
        <span className="fo-search-label">Search:</span>
        <div className="list-page-search">
          <Input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${title}`}
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm fo-go-btn">
          Search
        </button>
        {savedViewsSlot}
        {exportRows && (
          <Button
            size="sm"
            onClick={() => {
              void (async () => {
                setExporting(true);
                try {
                  const rows =
                    typeof exportRows === 'function' ? await exportRows() : exportRows;
                  downloadCsv(
                    exportFilename ?? title.toLowerCase().replace(/\s+/g, '-') + '.csv',
                    rows,
                    exportColumns,
                  );
                } finally {
                  setExporting(false);
                }
              })();
            }}
            disabled={
              exporting ||
              (typeof exportRows === 'function'
                ? exportCount === 0
                : exportRows.length === 0)
            }
            title={
              exporting
                ? 'Building the file'
                : (typeof exportRows === 'function' ? exportCount === 0 : exportRows.length === 0)
                  ? 'There is nothing in this list to export'
                  : undefined
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        )}
      </div>
      {secondSearchRow && (
        <div className="list-page-toolbar fo-search-row fo-second-search-row">
          {secondSearchRow}
        </div>
      )}
      </div>
      {filterRail && (
        <div className="list-page-filter-toggle">
          <button
            type="button"
            className="link-btn"
            aria-expanded={filtersOpen}
            aria-controls="list-filter-rail"
            onClick={() => (filtersOpen ? filters.requestClose() : setFiltersOpen(true))}
          >
            {filtersOpen ? 'Hide search options' : 'Search these records'}
          </button>
        </div>
      )}
      <div className="list-page-body">
        {filterRail && filtersOpen && (
          <aside
            className="filter-rail"
            id="list-filter-rail"
            data-closing={filters.closing ? 'true' : undefined}
          >
            <h2>Filters</h2>
            {filterRail}
          </aside>
        )}
        <div className="list-page-table">{children}</div>
      </div>
    </div>
    </ListPageFiltersContext.Provider>
  );
}
