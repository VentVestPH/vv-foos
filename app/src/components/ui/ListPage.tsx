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
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useAdvancedSearch, usePublishAdvancedSearch } from '../../shell/AdvancedSearch';
import { Button } from './Button';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';
import { SearchBox } from './SearchBox';
import type { SearchHintFetcher } from '../../lib/searchHints';
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

  onSearchSubmit?: (value: string) => void;
  searchPlaceholder?: string;

  searchHints?: SearchHintFetcher;

  filterRail?: ReactNode;

  savedViewsSlot?: ReactNode;

  actions?: ReactNode;

  breadcrumbs?: BreadcrumbItem[];

  bulkBar?: ReactNode;
  bulkBarOpen?: boolean;

  flush?: boolean;

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
  onSearchSubmit,
  searchPlaceholder = 'Search…',
  searchHints,
  filterRail,
  savedViewsSlot,
  actions,
  breadcrumbs,
  bulkBar,
  bulkBarOpen = false,
  flush = false,
  children,
  exportRows,
  exportCount,
  exportColumns,
  exportFilename,
}: ListPageProps) {
  const [exporting, setExporting] = useState(false);
  const [bulkBarSettled, setBulkBarSettled] = useState(false);
  useDocumentTitle(title);
  const advanced = useAdvancedSearch();
  usePublishAdvancedSearch(filterRail ?? null);
  const filtersOpen = advanced.open;
  const searchRef = useRef<HTMLInputElement>(null);
  const { columnFocusRequest, requestColumnFocus, openPanel, requestClose } = advanced;

  const openFilters = useCallback(
    (options?: { focusColumns?: boolean }) => {
      openPanel();
      if (options?.focusColumns) requestColumnFocus();
    },
    [openPanel, requestColumnFocus],
  );

  const filtersApi = useMemo<ListPageFiltersApi>(
    () => ({ filtersOpen, openFilters }),
    [filtersOpen, openFilters],
  );

  useEffect(() => {
    if (!bulkBarOpen) setBulkBarSettled(false);
  }, [bulkBarOpen]);

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
    <div className="list-page" data-flush={flush ? 'true' : undefined}>
      <div className="fo-page-head">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
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
      </div>
      <div className="fo-page-toolbar">
      <div className="list-page-toolbar fo-search-row">
        <SearchBox
          ref={searchRef}
          className="list-page-search"
          type="search"
          value={search}
          onValueChange={onSearchChange}
          onSubmitTerm={(term) =>
            onSearchSubmit ? onSearchSubmit(term) : onSearchChange(term)
          }
          onClear={() => {
            onSearchChange('');
            if (onSearchSubmit) onSearchSubmit('');
          }}
          placeholder={searchPlaceholder}
          ariaLabel={`Search ${title}`}
          fetchHints={searchHints}
          allLabel={(term, total) =>
            `Search all ${title.toLowerCase()} for “${term}” · ${total.toLocaleString()} ${
              total === 1 ? 'match' : 'matches'
            }`
          }
        />
        {filterRail && advanced.narrow && (
          <Button
            size="sm"
            aria-expanded={filtersOpen}
            aria-controls="list-filter-rail"
            onClick={() => (filtersOpen ? requestClose() : openPanel())}
          >
            Advanced Search
          </Button>
        )}
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
            disabled={exporting}
            title={
              exporting
                ? 'Building the file'
                : (typeof exportRows === 'function' ? exportCount === 0 : exportRows.length === 0)
                  ? 'There is nothing in this list to export yet'
                  : undefined
            }
          >
            {exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        )}
      </div>
      {bulkBar && (
        <div className="fo-page-head-foot" data-open={bulkBarOpen ? 'true' : 'false'}>
          {bulkBar && (
            <div
              className="fo-page-head-grow"
              data-open={bulkBarOpen ? 'true' : 'false'}
              data-settled={bulkBarOpen && bulkBarSettled ? 'true' : undefined}
              aria-hidden={bulkBarOpen ? undefined : true}
              {...(bulkBarOpen ? {} : { inert: '' })}
              onTransitionEnd={(event) => {
                if (event.propertyName === 'grid-template-rows') setBulkBarSettled(bulkBarOpen);
              }}
            >
              <div className="fo-page-head-grow-inner">{bulkBar}</div>
            </div>
          )}
        </div>
      )}
      </div>
      <div className="list-page-body">
        {filterRail && advanced.narrow && filtersOpen && (
          <aside
            className="filter-rail fo-qs-advanced-section"
            id="list-filter-rail"
            data-closing={advanced.closing ? 'true' : undefined}
          >
            {filterRail}
          </aside>
        )}
        <div className="list-page-table">{children}</div>
      </div>
    </div>
    </ListPageFiltersContext.Provider>
  );
}
