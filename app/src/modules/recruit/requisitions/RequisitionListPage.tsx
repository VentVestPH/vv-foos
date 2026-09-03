import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListLink } from '../../../lib/listReturn';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { REQUISITION_STATUSES } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { StatusBadge } from '../../../components/ui/Badge';
import { UnviewedBadge } from '../../../components/ui/UnviewedBadge';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, CappedCell, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Briefcase as BriefcaseIcon, User as PersonIcon } from 'lucide-react';
import type { Database, RequisitionStatus } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';

type RequisitionListRow = Omit<
  Database['public']['Views']['requisition_list']['Row'],
  'search_text'
>;
import { type Application, type SortState, errMsg, fmtDate } from '../lib';
import { useIsMobile, useLookups } from '../hooks';
import { SavedViewsControl, useSavedViews, type ViewState } from '../savedViews';

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
const ID_CHUNK = 200;

const REQ_VIEW_COLUMNS =
  'id, display_code, job_code, title, status, company_id, company_name, location, employment_type, num_openings, opened_date, filled_date, is_published, created_at, updated_at, owner_ids, owner_names, application_count';

const REQ_SORT_COLUMNS: Record<string, string> = {
  job_code: 'job_code',
  display_code: 'display_code',
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
  { key: 'job_code', header: 'Job code' },
  { key: 'display_code', header: 'ID' },
  { key: 'title', header: 'Title' },
  { key: 'applications', header: 'Candidates' },
  { key: 'updated_at', header: 'Last updated' },
  { key: 'location', header: 'Location' },
  { key: 'status', header: 'Status' },
  { key: 'owners', header: 'Requisition Owners' },
  { key: 'unviewed', header: 'Next Steps' },
  { key: 'company', header: 'Company' },
  { key: 'num_openings', header: 'Openings' },
  { key: 'opened_date', header: 'Opened' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

type AppSlim = Pick<Application, 'id' | 'requisition_id' | 'stage_changed_at'>;

export function RequisitionListPage() {
  const openRecord = useListLink();
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const savedViews = useSavedViews('requisition');
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ReqFilters>(() => ({
    status: params.get('status') ?? '',
    companyId: params.get('company_id') ?? '',
    ownerId: params.get('owner_id') ?? '',
    location: params.get('location') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
  }));
  const [sort, setSort] = useState<SortState | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMN_KEYS);

  const [reqs, setReqs] = useState<RequisitionListRow[]>([]);
  const [apps, setApps] = useState<AppSlim[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [viewedAt, setViewedAt] = useState<Map<string, string>>(new Map());
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
      const term = search.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${reqLikeLiteral(term)}%`);

      const sortColumn = sort ? REQ_SORT_COLUMNS[sort.key] : undefined;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('created_at', { ascending: false });
      }
      return out.order('id', { ascending: true });
    },
    [filters, search, sort],
  );

  const loadPage = useCallback(async () => {
    try {
      const start = page * REQ_PAGE_SIZE;
      const { data, count, error: listErr } = await applyReqFilters(requisitionBaseQuery()).range(
        start,
        start + REQ_PAGE_SIZE - 1,
      );
      if (listErr) throw new Error(listErr.message);
      const pageRows = data ?? [];
      setReqs(pageRows);
      setTotal(count ?? 0);

      const reqIds = pageRows.map((r) => r.id);
      if (reqIds.length === 0) {
        setApps([]);
        setViewedAt(new Map());
        setError(null);
        return;
      }

      const { data: appRows, error: appErr } = await supabase
        .from('applications')
        .select('id, requisition_id, stage_changed_at')
        .in('requisition_id', reqIds);
      if (appErr) throw new Error(appErr.message);
      const pageApps = appRows ?? [];
      setApps(pageApps);

      if (!staff || pageApps.length === 0) {
        setViewedAt(new Map());
        setError(null);
        return;
      }
      const seen = new Map<string, string>();
      const appIds = pageApps.map((a) => a.id);
      for (let i = 0; i < appIds.length; i += ID_CHUNK) {
        const { data: views, error: viewErr } = await supabase
          .from('application_views')
          .select('application_id, last_viewed_at')
          .eq('staff_id', staff.id)
          .in('application_id', appIds.slice(i, i + ID_CHUNK));
        if (viewErr) throw new Error(viewErr.message);
        for (const v of views ?? []) seen.set(v.application_id, v.last_viewed_at);
      }
      setViewedAt(seen);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [applyReqFilters, page, staff]);

  useEffect(() => {
    setPage(0);
  }, [filters, search, sort]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const channel = supabase
      .channel('recruit-req-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => void loadPage(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_views',
          ...(staff ? { filter: `staff_id=eq.${staff.id}` } : {}),
        },
        () => void loadPage(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void loadPage();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPage, staff]);


  const rows = useMemo<ReqRow[]>(() => {
    const appsByReq = new Map<string, AppSlim[]>();
    for (const a of apps) {
      const list = appsByReq.get(a.requisition_id) ?? [];
      list.push(a);
      appsByReq.set(a.requisition_id, list);
    }
    return reqs.map((r) => {
      const reqApps = appsByReq.get(r.id) ?? [];
      const unviewed = reqApps.filter((a) => {
        const seen = viewedAt.get(a.id);
        return !seen || seen < a.stage_changed_at;
      }).length;
      return {
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
        unviewed,
      };
    });
  }, [reqs, apps, viewedAt]);

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
      { key: 'job_code', header: 'Job Code', sortable: true },
      { key: 'display_code', header: 'ID', sortable: true },
      {
        key: 'title',
        header: 'Title',
        sortable: true,
        render: (r) => (
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/recruit/requisitions/${r.id}`);
            }}
          >
            {r.title}
          </button>
        ),
      },
      {
        key: 'applications',
        header: 'Candidates',
        sortable: true,
        sortValue: (r) => r.applications,
        render: (r) => (
          <span className="fo-candidates-cell">
            <PersonIcon size={18} />
            <span className="badge badge-success">{r.applications}</span>
          </span>
        ),
      },
      {
        key: 'updated_at',
        header: 'Last updated',
        sortable: true,
        render: (r) => fmtDate(r.updated_at),
      },
      { key: 'location', header: 'Location', sortable: true },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (r) => <StatusBadge status={r.status} />,
      },
      {
        key: 'owners',
        header: 'Requisition Owners',
        render: (r) => <CappedCell text={r.owners} />,
      },
      {
        key: 'unviewed',
        header: 'Next Steps',
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
                navigate(`/recruit/requisitions/${r.id}`);
              }}
            >
              Candidates ({r.applications})
            </button>
          </span>
        ),
      },
      { key: 'company', header: 'Company', sortable: true },
      {
        key: 'num_openings',
        header: 'Openings',
        sortable: true,
        sortValue: (r) => r.num_openings,
      },
      {
        key: 'opened_date',
        header: 'Opened',
        sortable: true,
        render: (r) => fmtDate(r.opened_date),
      },
    ];
    return defs.filter((c) => visibleCols.includes(c.key));
  }, [visibleCols, navigate]);

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
    if (state.columns.length > 0) setVisibleCols(state.columns);
    setSort(state.sort);
  }, []);

  const exportColumns = COLUMN_DEFS.filter((c) => visibleCols.includes(c.key));

  const canCreate = (role === 'admin' || role === 'recruiter') && !mobile;
  const canBulk = (role === 'admin' || role === 'recruiter') && !mobile;

  return (
    <ListPage
      title="Requisitions"
      icon={<BriefcaseIcon size={40} />}
      description="Requisitions are all of the job openings you want to track in Front Office OS and post on your careers website."
      search={search}
      onSearchChange={setSearch}
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
        canCreate ? (
          <Button variant="primary" onClick={() => navigate('/recruit/requisitions/new')}>
            New requisition
          </Button>
        ) : undefined
      }
      exportRows={exportRequisitionRows}
      exportCount={total}
      exportColumns={exportColumns}
      exportFilename="requisitions.csv"
      filterRail={
        <details className="fo-advanced-search" open>
          <summary>Advanced Search</summary>
          <div className="fo-advanced-search-body">
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
            <Input
              label="Opened from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            />
            <Input
              label="Opened to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            />
            <Select
              label="Sort by"
              placeholder="Default order"
              options={COLUMN_DEFS.map((c) => ({ value: c.key, label: c.header }))}
              value={sort?.key ?? ''}
              onChange={(e) =>
                setSort(
                  e.target.value
                    ? { key: e.target.value, dir: sort?.dir ?? 'asc' }
                    : null,
                )
              }
            />
            {sort && (
              <Select
                label="Direction"
                options={[
                  { value: 'asc', label: 'Ascending' },
                  { value: 'desc', label: 'Descending' },
                ]}
                value={sort.dir}
                onChange={(e) => setSort({ ...sort, dir: e.target.value as 'asc' | 'desc' })}
              />
            )}
            <div className="field">
              <span className="field-label">Columns</span>
              <div className="rq-checkbox-list">
                {COLUMN_DEFS.map((c) => (
                  <label key={c.key} className="rq-checkline">
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(c.key)}
                      onChange={(e) =>
                        setVisibleCols(
                          e.target.checked
                            ? [...visibleCols, c.key]
                            : visibleCols.filter((k) => k !== c.key),
                        )
                      }
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setSort(null);
                setVisibleCols(ALL_COLUMN_KEYS);
              }}
            >
              Clear filters
            </Button>
          </div>
        </details>
      }
    >
      {(error || savedViews.error) && (
        <p className="rq-error">{error ?? savedViews.error}</p>
      )}

      {canBulk && (
        <div className="record-action-bar fo-list-action-bar">
          {}
          <PlaceholderAction
            label="Delete"
            detail="Bulk delete isn't implemented for requisitions yet."
          />
          {}
          <PlaceholderAction label="Forms" />
          {}
          <PlaceholderAction
            label="Change status to…"
            caret
            detail="Change the status of one requisition at a time from its record page."
          />
        </div>
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      <Table
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.id}
        selectable={canBulk}
        selected={selected}
        onSelectionChange={setSelected}
        onRowClick={(r) => openRecord(`/recruit/requisitions/${r.id}`)}
        emptyText="No requisitions match."
      />

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
    </ListPage>
  );
}
