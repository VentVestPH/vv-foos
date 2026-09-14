import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { useSession } from '../../../auth/SessionProvider';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { BulkBar } from '../../../components/ui/BulkBar';
import { FilterGroup } from '../../../components/ui/FilterGroup';
import { ColumnSettingsDialog } from '../../../components/ui/ColumnSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { SavedViewsControl, useSavedViews, type ViewState } from '../../../components/ui/SavedViews';
import { useListLink } from '../../../lib/listReturn';
import { useSubmittedSearch } from '../../../lib/quickSearch';
import { companySearchHints } from '../../../lib/searchHints';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { Handshake as HandshakeIcon, Plus, Trash2 } from 'lucide-react';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useCanEditCrm, useStaffList } from '../hooks';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { fmtDate } from '../lib';
import { CompanyDeleteDialog, type CompanyDeleteTarget } from '../components/CompanyDeleteDialog';
import { EMPTY_CELL } from '../../../lib/format';
import { sentenceCase } from '../../../lib/format';

const COMPANY_PAGE_SIZE = 20;
const COMPANY_EXPORT_PAGE_SIZE = 1000;
const COMPANY_EXPORT_ROW_CAP = 10000;

const COMPANY_VIEW_COLUMNS =
  'id, name, types, website, city, state, country, phone, owner_id, owner_name, is_test, created_at, updated_at, location_text';

const COMPANY_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  website: 'website',
  location: 'location_text',
  phone: 'phone',
  owner: 'owner_name',
  updated_at: 'updated_at',
  types: 'name',
};

const COLUMN_DEFS: { key: string; header: string }[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Account Name' },
  { key: 'updated_at', header: 'Last Updated' },
  { key: 'city', header: 'City' },
  { key: 'state', header: 'State/Territory' },
  { key: 'phone', header: 'Phone' },
  { key: 'types', header: 'Type' },
  { key: 'country', header: 'Country' },
  { key: 'owner', header: 'Owner' },
  { key: 'website', header: 'Website' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

const COLUMN_HEADER: Record<string, string> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.header]),
);

const EMPTY_FILTERS = { type: '', owner: '', location: '' };

type CompanyFilters = typeof EMPTY_FILTERS;

type CompanyListRow = Omit<Database['public']['Views']['company_list']['Row'], 'search_text'>;

function companyLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function companyBaseQuery() {
  return supabase.from('company_list').select(COMPANY_VIEW_COLUMNS, { count: 'exact' });
}

type CompanyQuery = ReturnType<typeof companyBaseQuery>;

const TYPE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'employer', label: 'Employer' },
  { value: 'prospect', label: 'Prospect' },
];

export function CompaniesListPage() {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const openRecord = useListLink();
  const canEdit = useCanEditCrm();
  const mobile = useIsMobile();
  const canBulk = canEdit && !mobile;
  const { staff } = useSession();
  const { staffName, staffOptions } = useStaffList();
  const savedViews = useSavedViews('company');

  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();
  const [filters, setFilters] = useState<CompanyFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<CompanyDeleteTarget[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_KEYS);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const visibleCols = useMemo(
    () => columnOrder.filter((key) => !hiddenCols.includes(key)),
    [columnOrder, hiddenCols],
  );

  const applyCompanyFilters = useCallback(
    (q: CompanyQuery): CompanyQuery => {
      let out = q;
      if (filters.type) out = out.contains('types', [filters.type]);
      if (filters.owner) out = out.eq('owner_id', filters.owner);
      const loc = filters.location.trim();
      if (loc) out = out.ilike('location_text', `%${companyLikeLiteral(loc)}%`);
      const term = search.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${companyLikeLiteral(term)}%`);
      const sortColumn = sort ? COMPANY_SORT_COLUMNS[sort.key] : undefined;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('name', { ascending: true });
      }
      return out.order('id', { ascending: true });
    },
    [filters, search, sort],
  );

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      const start = page * COMPANY_PAGE_SIZE;
      const { data, count, error } = await applyCompanyFilters(companyBaseQuery()).range(
        start,
        start + COMPANY_PAGE_SIZE - 1,
      );
      if (error) throw new Error(error.message);
      if (!isCurrent()) return;
      setCompanies(data ?? []);
      setTotal(count ?? 0);
      setLoaded(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [applyCompanyFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [filters, search, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeSelection = useCallback((next: Set<string>) => {
    setNotice(null);
    setSelected(next);
  }, []);

  const columns = useMemo<TableColumn<CompanyListRow>[]>(() => {
    const defs: Record<string, TableColumn<CompanyListRow>> = {
      id: {
        key: 'id',
        header: 'ID',
        render: (c) => c.id.slice(0, 8).toUpperCase(),
      },
      name: {
        key: 'name',
        header: 'Account Name',
        sortable: true,
        render: (c) => (
          <span className="sales-badges">
            <button
              type="button"
              className="link-btn"
              onClick={(e) => {
                e.stopPropagation();
                openRecord(`/sales/companies/${c.id}`);
              }}
            >
              {c.name}
            </button>
            {c.is_test && <Badge tone="warning">TEST</Badge>}
          </span>
        ),
      },
      updated_at: {
        key: 'updated_at',
        header: 'Last Updated',
        sortable: true,
        render: (c) => fmtDate(c.updated_at),
      },
      city: {
        key: 'city',
        header: 'City',
        sortable: true,
        render: (c) => c.city ?? EMPTY_CELL,
      },
      state: {
        key: 'state',
        header: 'State/Territory',
        sortable: true,
        hideWhenEmpty: true,
        render: (c) => c.state ?? EMPTY_CELL,
      },
      phone: {
        key: 'phone',
        header: 'Phone',
        render: (c) => c.phone ?? EMPTY_CELL,
      },
      types: {
        key: 'types',
        header: 'Type',
        render: (c) => (
          <span className="sales-badges">
            {c.types.map((t: string) => (
              <Badge key={t} tone={t === 'client' ? 'primary' : 'neutral'}>
                {sentenceCase(t)}
              </Badge>
            ))}
          </span>
        ),
      },
      country: {
        key: 'country',
        header: 'Country',
        render: (c) => c.country ?? EMPTY_CELL,
      },
      owner: {
        key: 'owner',
        header: 'Owner',
        sortable: true,
        sortValue: (c) => staffName(c.owner_id),
        render: (c) => staffName(c.owner_id),
      },
      website: {
        key: 'website',
        header: 'Website',
        render: (c) => c.website ?? EMPTY_CELL,
      },
    };
    return visibleCols.flatMap((key) => {
      const col = defs[key];
      return col ? [col] : [];
    });
  }, [visibleCols, openRecord, staffName]);

  const exportCompanyRows = useCallback(async () => {
    if (total > COMPANY_EXPORT_ROW_CAP) return [];
    const collected: CompanyListRow[] = [];
    for (let start = 0; start < COMPANY_EXPORT_ROW_CAP; start += COMPANY_EXPORT_PAGE_SIZE) {
      const { data, error } = await applyCompanyFilters(companyBaseQuery()).range(
        start,
        start + COMPANY_EXPORT_PAGE_SIZE - 1,
      );
      if (error) return [];
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < COMPANY_EXPORT_PAGE_SIZE) break;
    }
    return collected
      .filter((c) => !c.is_test)
      .map((c) => ({
        name: c.name,
        types: c.types.join('|'),
        website: c.website,
        city: c.city,
        state: c.state,
        country: c.country,
        phone: c.phone,
        owner: c.owner_name ?? '',
      }));
  }, [applyCompanyFilters, total]);

  const currentState = useCallback(
    (): ViewState => ({
      filters: { ...filters },
      columns: visibleCols,
      sort,
    }),
    [filters, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    setFilters({ ...EMPTY_FILTERS, ...(state.filters as Partial<CompanyFilters>) });
    if (state.columns.length > 0) {
      const saved = state.columns.filter((k) => ALL_COLUMN_KEYS.includes(k));
      setColumnOrder([...saved, ...ALL_COLUMN_KEYS.filter((k) => !saved.includes(k))]);
      setHiddenCols(ALL_COLUMN_KEYS.filter((k) => !saved.includes(k)));
    }
    setSort(state.sort);
  }, []);

  const pageCount = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * COMPANY_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * COMPANY_PAGE_SIZE),
    pageRows: companies,
  };

  const showSkeleton = useMinimumVisible(loading);

  const narrowed =
    search.trim() !== '' || filters.type !== '' || filters.owner !== '' || filters.location.trim() !== '';

  const selectedTargets = companies
    .filter((c) => selected.has(c.id))
    .map((c) => ({ id: c.id, name: c.name }));

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Accounts' }]}
      title="Accounts"
      icon={<HandshakeIcon size={32} />}
      description="Accounts are the companies and organizations involved with your business such as employers, customers, search firms, agencies, etc."
      flush
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchHints={companySearchHints}
      searchPlaceholder="Search name, website, location…"
      savedViewsSlot={
        <SavedViewsControl
          views={savedViews.views}
          currentState={currentState}
          onApply={applyView}
          onSave={savedViews.save}
          onDelete={savedViews.remove}
          ownStaffId={staff?.id}
        />
      }
      actions={
        <>
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/sales/companies/new')}>
              <Plus size={20} aria-hidden="true" />
              New Account
            </Button>
          )}
          <SettingsButton
            label="Column settings"
            title="Choose the column order and which columns show"
            onClick={() => setSettingsOpen(true)}
          />
        </>
      }
      bulkBarOpen={canBulk && selected.size > 0}
      bulkBar={
        canBulk ? (
          <BulkBar count={selected.size}>
            <Button
              variant="danger"
              disabled={selectedTargets.length === 0}
              title={
                selectedTargets.length === 0
                  ? 'Tick an account to delete it.'
                  : undefined
              }
              onClick={() => setDeleting(selectedTargets)}
            >
              <Trash2 size={20} aria-hidden="true" />
              Delete
            </Button>
          </BulkBar>
        ) : undefined
      }
      filterRail={
          <div className="fo-advanced-search-body">
            <FilterGroup label="Filter" defaultOpen>
              <Select
                label="Type"
                options={TYPE_OPTIONS}
                placeholder="All types"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              />
              <Select
                label="Owner"
                options={staffOptions}
                placeholder="All owners"
                value={filters.owner}
                onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
              />
              <Input
                label="Location"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="City, state, country"
              />
            </FilterGroup>
          </div>
      }
      exportRows={exportCompanyRows}
      exportCount={total}
      exportColumns={visibleCols.map((key) => ({ key, header: COLUMN_HEADER[key] ?? key }))}
      exportFilename="companies.csv"
    >
      {notice && (
        <p className="text-secondary fo-bulk-notice" role="status">
          {notice}
        </p>
      )}
      {savedViews.error && (
        <p className="form-error" role="alert">
          {savedViews.error}
        </p>
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      {showSkeleton ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading accounts" />
        </div>
      ) : loaded && total === 0 && !narrowed ? (
        <EmptyState
          icon={<HandshakeIcon size={64} aria-hidden="true" />}
          title="No accounts yet"
          hint="An account is a company you work with: an employer, a client, a search firm. Add the first one and requisitions, contacts and deals can hang off it."
        >
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/sales/companies/new')}>
              <Plus size={20} aria-hidden="true" />
              New Account
            </Button>
          )}
        </EmptyState>
      ) : (
        <Table
          busy={loading}
          columns={columns}
          rows={pager.pageRows}
          rowKey={(c) => c.id}
          sortKey={sort?.key ?? null}
          sortDir={sort?.dir ?? 'asc'}
          onSortChange={(key, dir) => setSort({ key, dir })}
          selectable={canBulk}
          selected={selected}
          onSelectionChange={changeSelection}
          onRowClick={(c) => openRecord(`/sales/companies/${c.id}`)}
          emptyIcon={<HandshakeIcon size={32} />}
          emptyText="No account matches that search."
        />
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      {settingsOpen && (
        <ColumnSettingsDialog
          title="Column settings"
          hint="Drag a column to change where it sits, or untick it to hide it. Save a view to keep this arrangement."
          columns={COLUMN_DEFS}
          order={columnOrder}
          hidden={hiddenCols}
          onOrderChange={setColumnOrder}
          onToggle={(key) =>
            setHiddenCols(
              hiddenCols.includes(key)
                ? hiddenCols.filter((k) => k !== key)
                : [...hiddenCols, key],
            )
          }
          onReset={() => {
            setColumnOrder(ALL_COLUMN_KEYS);
            setHiddenCols([]);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {deleting && (
        <CompanyDeleteDialog
          targets={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(count) => {
            setDeleting(null);
            setSelected(new Set());
            setNotice(
              count === 1 ? '1 account deleted.' : `${count} accounts deleted.`,
            );
            void load();
          }}
        />
      )}
    </ListPage>
  );
}
