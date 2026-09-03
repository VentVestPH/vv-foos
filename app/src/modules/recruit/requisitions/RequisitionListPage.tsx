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
import { Pager, usePagination } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Briefcase as BriefcaseIcon, User as PersonIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { type Application, type OwnerRow, type Requisition, type SortState, errMsg, fmtDate, sortRows } from '../lib';
import { useIsMobile, useLookups } from '../hooks';
import { SavedViewsControl, useSavedViews, type ViewState } from '../savedViews';
import { EMPTY_CELL } from '../../../lib/format';
import { fetchAllRows } from '../../../lib/fetchAll';

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

  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [apps, setApps] = useState<AppSlim[]>([]);
  const [viewedAt, setViewedAt] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadStatic = useCallback(async () => {
    try {
      const [reqRows, ownerRows] = await Promise.all([
        fetchAllRows((f, t) =>
          supabase
            .from('requisitions')
            .select('*')
            .order('created_at', { ascending: false })
            .range(f, t),
        ),
        fetchAllRows((f, t) => supabase.from('requisition_owners').select('*').range(f, t)),
      ]);
      setReqs(reqRows);
      setOwners(ownerRows);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  const loadApps = useCallback(async () => {
    try {
      const [appRows, v] = await Promise.all([
        fetchAllRows((f, t) =>
          supabase
            .from('applications')
            .select('id, requisition_id, stage_changed_at')
            .range(f, t),
        ),
        staff
          ? supabase
              .from('application_views')
              .select('*')
              .eq('staff_id', staff.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (v.error) throw new Error(v.error.message);
      setApps(appRows);
      setViewedAt(
        new Map(
          (v.data ?? []).map(
            (row) => [row.application_id, row.last_viewed_at] as [string, string],
          ),
        ),
      );
    } catch (e) {
      setError(errMsg(e));
    }
  }, [staff]);

  useEffect(() => {
    void loadStatic();
  }, [loadStatic]);

  useEffect(() => {
    void loadApps();
  }, [loadApps]);

  useEffect(() => {
    const channel = supabase
      .channel('recruit-req-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications' },
        () => void loadApps(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'application_views',
          ...(staff ? { filter: `staff_id=eq.${staff.id}` } : {}),
        },
        () => void loadApps(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void loadApps();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadApps, staff]);

  const companyName = useMemo(
    () => new Map(lookups.companies.map((c) => [c.id, c.name])),
    [lookups.companies],
  );
  const staffName = useMemo(
    () => new Map(lookups.staff.map((s) => [s.id, s.full_name])),
    [lookups.staff],
  );

  const rows = useMemo<ReqRow[]>(() => {
    const ownersByReq = new Map<string, string[]>();
    for (const o of owners) {
      const list = ownersByReq.get(o.requisition_id) ?? [];
      list.push(staffName.get(o.staff_id) ?? EMPTY_CELL);
      ownersByReq.set(o.requisition_id, list);
    }
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
        company: r.company_id ? (companyName.get(r.company_id) ?? '') : '',
        location: r.location ?? '',
        status: r.status,
        num_openings: r.num_openings,
        owners: (ownersByReq.get(r.id) ?? []).join(', '),
        opened_date: r.opened_date ?? '',
        updated_at: r.updated_at,
        applications: reqApps.length,
        unviewed,
      };
    });
  }, [reqs, owners, apps, viewedAt, companyName, staffName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ownedIds = filters.ownerId
      ? new Set(
          owners
            .filter((o) => o.staff_id === filters.ownerId)
            .map((o) => o.requisition_id),
        )
      : null;
    const base = rows.filter((r) => {
      if (filters.status && r.status !== filters.status) return false;
      if (filters.companyId) {
        const req = reqs.find((x) => x.id === r.id);
        if (req?.company_id !== filters.companyId) return false;
      }
      if (ownedIds && !ownedIds.has(r.id)) return false;
      if (
        filters.location &&
        !r.location.toLowerCase().includes(filters.location.toLowerCase())
      ) {
        return false;
      }
      if (filters.dateFrom && (!r.opened_date || r.opened_date < filters.dateFrom)) {
        return false;
      }
      if (filters.dateTo && (!r.opened_date || r.opened_date > filters.dateTo)) {
        return false;
      }
      if (q) {
        const hay =
          `${r.display_code} ${r.job_code} ${r.title} ${r.company} ${r.location}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return sortRows(base, sort);
  }, [rows, reqs, owners, filters, search, sort]);

  const pager = usePagination(filtered);

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
      exportRows={filtered}
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
