import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListLink } from '../../../lib/listReturn';
import { useSubmittedSearch } from '../../../lib/quickSearch';
import { requisitionSearchHints } from '../../../lib/searchHints';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { REQUISITION_STATUSES } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { UnviewedBadge } from '../../../components/ui/UnviewedBadge';
import { ListPage } from '../../../components/ui/ListPage';
import { FilterFoot, FilterGroup } from '../../../components/ui/FilterGroup';
import { Table, CappedCell, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Briefcase as BriefcaseIcon, Plus, User as PersonIcon } from 'lucide-react';
import type { Database, RequisitionStatus } from '../../../lib/database.types';
import { realtimeChannel } from '../../../lib/realtimeChannel';
import { supabase } from '../../../lib/supabase';
import { useCoalescedReload } from '../../../lib/useCoalescedReload';
import { useLatestOnly } from '../../../lib/useLatestOnly';

type RequisitionListRow = Omit<
  Database['public']['Views']['requisition_list']['Row'],
  'search_text'
>;
import { REQ_ACTION_LABELS, REQ_TRANSITIONS, type SortState, errMsg, fmtDate } from '../lib';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { ColumnSettingsDialog } from '../../../components/ui/ColumnSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { useIsMobile, useLookups } from '../hooks';
import {
  SavedViewsControl,
  useSavedViews,
  type ViewState,
} from '../../../components/ui/SavedViews';

interface ReqFilters {
  status: string;
  companyId: string;
  ownerId: string;
  location: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: ReqFilters = {
  status: '',
  companyId: '',
  ownerId: '',
  location: '',
  dateFrom: '',
  dateTo: '',
};

const REQ_PAGE_SIZE = 20;
const REQ_EXPORT_PAGE_SIZE = 1000;
const REQ_EXPORT_ROW_CAP = 10000;

const REQ_VIEW_COLUMNS =
  'id, display_code, job_code, title, status, company_id, company_name, location, employment_type, num_openings, opened_date, filled_date, is_published, created_at, updated_at, owner_ids, owner_names, application_count, unviewed_count';

const REQ_SORT_COLUMNS: Record<string, string> = {
  job_code: 'job_code',
  display_code: 'display_code',
  owners: 'owner_names',
  title: 'title',
  company: 'company_name',
  location: 'location',
  status: 'status',
  num_openings: 'num_openings',
  opened_date: 'opened_date',
  updated_at: 'updated_at',
  applications: 'application_count',
};

function reqLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function requisitionBaseQuery() {
  return supabase.from('requisition_list').select(REQ_VIEW_COLUMNS, { count: 'exact' });
}

type RequisitionQuery = ReturnType<typeof requisitionBaseQuery>;

interface ReqRow extends Record<string, unknown> {
  id: string;
  display_code: string;
  job_code: string;
  title: string;
  company: string;
  location: string;
  status: string;
  num_openings: number;
  owners: string;
  opened_date: string;
  updated_at: string;
  applications: number;
  unviewed: number;
}

const COLUMN_DEFS: { key: keyof ReqRow & string; header: string }[] = [
  { key: 'job_code', header: 'Job Code' },
  { key: 'display_code', header: 'ID' },
  { key: 'title', header: 'Title' },
  { key: 'applications', header: 'Candidates' },
  { key: 'updated_at', header: 'Last updated' },
  { key: 'location', header: 'Location' },
  { key: 'status', header: 'Status' },
  { key: 'owners', header: 'Owners' },
  { key: 'unviewed', header: 'Next Steps' },
  { key: 'company', header: 'Company' },
  { key: 'num_openings', header: 'Openings' },
  { key: 'opened_date', header: 'Opened' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

const COLUMN_HEADER: Record<string, string> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.header]),
);


const REQ_LIST_EVENTS = [
  'application.created',
  'application.stage_changed',
  'application.hired',
  'requisition.status_changed',
] as const;

const REQ_LIST_EVENT_FILTER = `event_name=in.(${REQ_LIST_EVENTS.join(',')})`;

export function RequisitionListPage() {
  const openRecord = useListLink();
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const savedViews = useSavedViews('requisition');
  const [params] = useSearchParams();

  const {
    input: searchInput,
    setInput: setSearchInput,
    term: searchTerm,
    submit: submitSearch,
  } = useSubmittedSearch();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filters, setFilters] = useState<ReqFilters>(() => ({
    status: params.get('status') ?? '',
    companyId: params.get('company_id') ?? '',
    ownerId: params.get('owner_id') ?? '',
    location: params.get('location') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
  }));
  const [sort, setSort] = useState<SortState | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_KEYS);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const visibleCols = useMemo(
    () => columnOrder.filter((key) => !hiddenCols.includes(key)),
    [columnOrder, hiddenCols],
  );

  const [reqs, setReqs] = useState<RequisitionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const applyReqFilters = useCallback(
    (q: RequisitionQuery): RequisitionQuery => {
      let out = q;
      if (filters.status) out = out.eq('status', filters.status as RequisitionStatus);
      if (filters.companyId) out = out.eq('company_id', filters.companyId);
      if (filters.ownerId) out = out.contains('owner_ids', [filters.ownerId]);
      if (filters.location) {
        out = out.ilike('location', `%${reqLikeLiteral(filters.location.trim())}%`);
      }
      if (filters.dateFrom) out = out.gte('opened_date', filters.dateFrom);
      if (filters.dateTo) out = out.lte('opened_date', filters.dateTo);
      const term = searchTerm.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${reqLikeLiteral(term)}%`);

      const sortColumn = sort ? REQ_SORT_COLUMNS[sort.key] : undefined;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('created_at', { ascending: false });
      }
      return out.order('id', { ascending: true });
    },
    [filters, searchTerm, sort],
  );

  const beginLoad = useLatestOnly();

  const loadPage = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      const start = page * REQ_PAGE_SIZE;
      const { data, count, error: listErr } = await applyReqFilters(requisitionBaseQuery()).range(
        start,
        start + REQ_PAGE_SIZE - 1,
      );
      if (listErr) throw new Error(listErr.message);
      if (!isCurrent()) return;
      const pageRows = data ?? [];
      setReqs(pageRows);
      setTotal(count ?? 0);

      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [applyReqFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [filters, searchTerm, sort]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const reloadSoon = useCoalescedReload(loadPage);

  useEffect(() => {
    const channel = realtimeChannel('recruit-req-list')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events_outbox',
          filter: REQ_LIST_EVENT_FILTER,
        },
        reloadSoon,
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'applications' },
        reloadSoon,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_views',
          ...(staff ? { filter: `staff_id=eq.${staff.id}` } : {}),
        },
        reloadSoon,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reloadSoon();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reloadSoon, staff]);


  const rows = useMemo<ReqRow[]>(
    () =>
      reqs.map((r) => ({
        id: r.id,
        display_code: r.display_code,
        job_code: r.job_code ?? '',
        title: r.title,
        company: r.company_name ?? '',
        location: r.location ?? '',
        status: r.status,
        num_openings: r.num_openings,
        owners: r.owner_names.join(', '),
        opened_date: r.opened_date ?? '',
        updated_at: r.updated_at,
        applications: r.application_count,
        unviewed: r.unviewed_count,
      })),
    [reqs],
  );

  const showSkeleton = useMinimumVisible(loading);

  const pageCount = Math.max(1, Math.ceil(total / REQ_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * REQ_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * REQ_PAGE_SIZE),
    pageRows: rows,
  };

  const exportRequisitionRows = useCallback(async () => {
    if (total > REQ_EXPORT_ROW_CAP) {
      setError(
        `That filter matches ${total.toLocaleString()} requisitions, more than the ${REQ_EXPORT_ROW_CAP.toLocaleString()} an in-browser export can build. Narrow the filter and try again.`,
      );
      return [];
    }
    const collected: RequisitionListRow[] = [];
    for (let start = 0; start < REQ_EXPORT_ROW_CAP; start += REQ_EXPORT_PAGE_SIZE) {
      const { data, error: pageErr } = await applyReqFilters(requisitionBaseQuery()).range(
        start,
        start + REQ_EXPORT_PAGE_SIZE - 1,
      );
      if (pageErr) {
        setError(pageErr.message);
        return [];
      }
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < REQ_EXPORT_PAGE_SIZE) break;
    }
    setError(null);
    return collected.map((r) => ({
      id: r.id,
      display_code: r.display_code,
      job_code: r.job_code ?? '',
      title: r.title,
      company: r.company_name ?? '',
      location: r.location ?? '',
      status: r.status,
      num_openings: r.num_openings,
      owners: r.owner_names.join(', '),
      opened_date: r.opened_date ?? '',
      updated_at: r.updated_at,
      applications: r.application_count,
      unviewed: 0,
    }));
  }, [applyReqFilters, total]);

  const columns = useMemo<TableColumn<ReqRow>[]>(() => {
    const defs: TableColumn<ReqRow>[] = [
      { key: 'job_code', header: COLUMN_HEADER.job_code, sortable: true },
      { key: 'display_code', header: COLUMN_HEADER.display_code, sortable: true, nowrap: true },
      {
        key: 'title',
        header: COLUMN_HEADER.title,
        sortable: true,
        render: (r) => (
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              openRecord(`/recruit/requisitions/${r.id}`);
            }}
          >
            {r.title}
          </button>
        ),
      },
      {
        key: 'applications',
        header: COLUMN_HEADER.applications,
        sortable: true,
        sortValue: (r) => r.applications,
        render: (r) => (
          <span className="fo-candidates-cell">
            <PersonIcon size={20} />
            <Badge tone="count">{r.applications}</Badge>
          </span>
        ),
      },
      {
        key: 'updated_at',
        header: COLUMN_HEADER.updated_at,
        sortable: true,
        render: (r) => fmtDate(r.updated_at),
      },
      { key: 'location', header: COLUMN_HEADER.location, sortable: true },
      {
        key: 'status',
        header: COLUMN_HEADER.status,
        sortable: true,
        render: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: 'owners',
        header: COLUMN_HEADER.owners,
        sortable: true,
        render: (r) => <CappedCell text={r.owners} />,
      },
      {
        key: 'unviewed',
        header: COLUMN_HEADER.unviewed,
        sortable: true,
        sortValue: (r) => r.unviewed,
        render: (r) => (
          <span className="fo-next-steps-cell">
            <UnviewedBadge count={r.unviewed} />
            <button
              type="button"
              className="link-btn"
              onClick={(e) => {
                e.stopPropagation();
                openRecord(`/recruit/requisitions/${r.id}`);
              }}
            >
              Candidates ({r.applications})
            </button>
          </span>
        ),
      },
      { key: 'company', header: COLUMN_HEADER.company, sortable: true, hideWhenEmpty: true },
      {
        key: 'num_openings',
        header: COLUMN_HEADER.num_openings,
        sortable: true,
        sortValue: (r) => r.num_openings,
      },
      {
        key: 'opened_date',
        header: COLUMN_HEADER.opened_date,
        sortable: true,
        render: (r) => fmtDate(r.opened_date),
      },
    ];
    const byKey = new Map(defs.map((c) => [c.key, c]));
    return visibleCols
      .map((key) => byKey.get(key))
      .filter((c): c is (typeof defs)[number] => c !== undefined);
  }, [visibleCols, openRecord]);

  const currentState = useCallback(
    (): ViewState => ({
      filters: { ...filters } as unknown as Record<string, string>,
      columns: visibleCols,
      sort,
    }),
    [filters, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    setFilters({ ...EMPTY_FILTERS, ...(state.filters as Partial<ReqFilters>) });
    if (state.columns.length > 0) {
      const rest = ALL_COLUMN_KEYS.filter((key) => !state.columns.includes(key));
      setColumnOrder([...state.columns, ...rest]);
      setHiddenCols(rest);
    }
    setSort(state.sort);
  }, []);

  const exportColumns = visibleCols
    .map((key) => COLUMN_DEFS.find((c) => c.key === key))
    .filter((c): c is (typeof COLUMN_DEFS)[number] => c !== undefined);

  const filtersDirty =
    Object.values(filters).some((v) => v !== '') ||
    sort !== null ||
    hiddenCols.length > 0 ||
    columnOrder.some((key, i) => key !== ALL_COLUMN_KEYS[i]);

  const canCreate = (role === 'admin' || role === 'recruiter') && !mobile;
  const canBulk = (role === 'admin' || role === 'recruiter') && !mobile;

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const changeSelection = useCallback((next: Set<string>) => {
    setBulkNotice(null);
    setSelected(next);
  }, []);

  const bulkTargets = useMemo(() => {
    const chosen = reqs.filter((r) => selected.has(r.id));
    const eligible = new Map<RequisitionStatus, number>();
    for (const r of chosen) {
      for (const target of REQ_TRANSITIONS[r.status]) {
        eligible.set(target, (eligible.get(target) ?? 0) + 1);
      }
    }
    return REQUISITION_STATUSES.filter((s) => eligible.has(s)).map((s) => ({
      value: s,
      eligible: eligible.get(s) ?? 0,
      of: chosen.length,
    }));
  }, [reqs, selected]);

  const bulkChangeStatus = async (target: RequisitionStatus) => {
    const ids = reqs
      .filter((r) => selected.has(r.id) && REQ_TRANSITIONS[r.status].includes(target))
      .map((r) => r.id);
    if (ids.length === 0) return;
    const attempted = selected.size;
    setBulkBusy(true);
    setError(null);
    setBulkNotice(null);
    const { error: err } = await supabase
      .from('requisitions')
      .update({ status: target })
      .in('id', ids);
    setBulkBusy(false);
    if (err) {
      setError(`Could not change status: ${err.message}`);
      return;
    }
    const label = target.replace(/_/g, ' ');
    const skipped = attempted - ids.length;
    setBulkNotice(
      skipped === 0
        ? `${ids.length} ${ids.length === 1 ? 'requisition' : 'requisitions'} set to ${label}.`
        : `${ids.length} of ${attempted} set to ${label}. ${skipped} unchanged, because ${label} is not a legal next status from where they are.`,
    );
    setSelected(new Set());
    void loadPage();
  };

  return (
    <ListPage
      title="Requisitions"
      icon={<BriefcaseIcon size={32} />}
      description="Requisitions are all of the job openings you want to track in Front Office OS and post on your careers website."
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Requisitions' }]}
      flush
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchHints={requisitionSearchHints}
      searchPlaceholder="Search code, title, company, location…"
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
          {canCreate && (
            <Button variant="primary" onClick={() => navigate('/recruit/requisitions/new')}>
              <Plus size={20} aria-hidden="true" />
              New requisition
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
          <div className="record-action-bar fo-list-action-bar">
            <Select
              aria-label="Change status to"
              placeholder="Change status to…"
              placeholderSelectable={false}
              value=""
              disabled={selected.size === 0 || bulkBusy || bulkTargets.length === 0}
              title={
                bulkBusy
                  ? 'Applying the change'
                  : bulkTargets.length === 0
                    ? 'Every selected requisition is closed, which has no next status'
                    : undefined
              }
              options={bulkTargets.map((t) => ({
                value: t.value,
                label:
                  t.eligible === t.of
                    ? REQ_ACTION_LABELS[t.value]
                    : `${REQ_ACTION_LABELS[t.value]} (${t.eligible} of ${t.of})`,
              }))}
              onChange={(e) => void bulkChangeStatus(e.target.value as RequisitionStatus)}
            />
            {selected.size > 0 && (
              <span className="text-secondary fo-bulk-hint">
                {bulkTargets.length === 0
                  ? 'Every selected requisition is closed, which has no next status.'
                  : `${selected.size} selected.`}
              </span>
            )}
          </div>
        ) : undefined
      }
      exportRows={exportRequisitionRows}
      exportCount={total}
      exportColumns={exportColumns}
      exportFilename="requisitions.csv"
      filterRail={
          <div className="fo-advanced-search-body">
            <FilterGroup label="Filter" defaultOpen>
              <Select
                label="Status"
                placeholder="All statuses"
                options={REQUISITION_STATUSES.map((s) => ({
                  value: s,
                  label: s.replace(/_/g, ' '),
                }))}
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              />
              <Select
                label="Company"
                placeholder="All companies"
                options={lookups.companies.map((c) => ({ value: c.id, label: c.name }))}
                value={filters.companyId}
                onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
              />
              <Select
                label="Owner"
                placeholder="All owners"
                options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
                value={filters.ownerId}
                onChange={(e) => setFilters({ ...filters, ownerId: e.target.value })}
              />
              <Input
                label="Location"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="Contains…"
              />
            </FilterGroup>
            <FilterGroup label="Opened">
              <DateField
                label="From"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
              <DateField
                label="To"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </FilterGroup>
            <FilterGroup
              label={`Columns (${visibleCols.length} of ${ALL_COLUMN_KEYS.length})`}
             
            >
              <div className="field">
                <div className="checkbox-list">
                  {COLUMN_DEFS.map((c) => (
                    <label key={c.key} className="checkline">
                      <input
                        type="checkbox"
                        checked={!hiddenCols.includes(c.key)}
                        onChange={(e) =>
                          setHiddenCols(
                            e.target.checked
                              ? hiddenCols.filter((k) => k !== c.key)
                              : [...hiddenCols, c.key],
                          )
                        }
                      />
                      {c.header}
                    </label>
                  ))}
                </div>
              </div>
            </FilterGroup>
            <FilterFoot>
              <Button
                size="sm"
                variant="ghost"
                disabled={!filtersDirty}
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setSort(null);
                  setColumnOrder(ALL_COLUMN_KEYS);
                  setHiddenCols([]);
                }}
              >
                Clear filters
              </Button>
            </FilterFoot>
          </div>
      }
    >
      {(error || savedViews.error) && (
        <p className="form-error" role="alert">{error ?? savedViews.error}</p>
      )}

      {bulkNotice && (
        <p className="text-secondary fo-bulk-notice" role="status">
          {bulkNotice}
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
          <Skeleton rows={8} label="Loading requisitions" />
        </div>
      ) : (
      <Table
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.id}
        busy={loading}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        selectable={canBulk}
        selected={selected}
        onSelectionChange={changeSelection}
        onRowClick={(r) => openRecord(`/recruit/requisitions/${r.id}`)}
        emptyText="No requisitions match."
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
          columns={COLUMN_DEFS.map((c) => ({ key: c.key, header: c.header }))}
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
    </ListPage>
  );
}
