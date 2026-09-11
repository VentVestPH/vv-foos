import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useListLink } from '../../../lib/listReturn';
import { useSubmittedSearch, searchWords } from '../../../lib/quickSearch';
import { candidateSearchHints } from '../../../lib/searchHints';
import { EMPTY_CELL } from '../../../lib/format';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, CappedCell, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ColumnSettingsDialog } from '../../../components/ui/ColumnSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { FileText as ResumeIcon, Flag as FlagIcon, User as PersonIcon } from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { StarGrade } from '../../../components/ui/StarGrade';
import { realtimeChannel } from '../../../lib/realtimeChannel';
import { supabase } from '../../../lib/supabase';
import { useCoalescedReload } from '../../../lib/useCoalescedReload';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import {
  type Application,
  type Requisition,
  type SortState,
  errMsg,
  fmtDate,
} from '../lib';
import {
  ALL_COLUMN_KEYS,
  DEFAULT_COLUMN_KEYS,
  COLUMN_DEFS,
  EMPTY_FILTERS,
  buildCandidateRows,
  SORT_COLUMNS,
  type CandFilters,
  type CandRow,
  type CandidateListRow,
} from './candidateRows';
import { useIsMobile, useLookups } from '../hooks';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { SavedViewsControl, useSavedViews, type ViewState } from '../savedViews';
import { CandidateBulkActions } from './CandidateBulkActions';
import { CandidateFilterRail } from './CandidateFilterRail';

const CANDIDATE_PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 1000;
const EXPORT_ROW_CAP = 10000;
const APP_LOOKUP_CHUNK = 200;

const CANDIDATE_VIEW_COLUMNS =
  'person_id, first_name, middle_name, last_name, full_name, emails, city, state, country, person_updated_at, status_id, star_grade, grade_comment, current_title, current_employer, initial_date, source_id, sourcer_id, do_not_contact, status_label, source_name, sourcer_name, has_resume';

function candidateBaseQuery() {
  return supabase.from('candidate_list').select(CANDIDATE_VIEW_COLUMNS);
}

function candidateCountQuery() {
  return supabase
    .from('candidate_list')
    .select(CANDIDATE_VIEW_COLUMNS, { count: 'exact', head: true })
    .range(0, 0);
}

type CandidateQuery = ReturnType<typeof candidateBaseQuery>;

function likeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

export function CandidateListPage() {
  const openRecord = useListLink();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const savedViews = useSavedViews('candidate');
  const [params] = useSearchParams();

  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();

  const [filters, setFilters] = useState<CandFilters>(() => ({
    statusId: params.get('status') ?? '',
    starGrade: params.get('star_grade') ?? '',
    sourceId: params.get('source_id') ?? '',
    sourcerId: params.get('sourcer_id') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
  }));
  const [sort, setSort] = useState<SortState | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_KEYS);
  const [hiddenCols, setHiddenCols] = useState<string[]>(
    ALL_COLUMN_KEYS.filter((k) => !DEFAULT_COLUMN_KEYS.includes(k)),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const visibleCols = useMemo(
    () => columnOrder.filter((k) => !hiddenCols.includes(k)),
    [columnOrder, hiddenCols],
  );

  const [profiles, setProfiles] = useState<CandidateListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [commentEdit, setCommentEdit] = useState<CandidateListRow | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const applyWhere = useCallback(
    (q: CandidateQuery): CandidateQuery => {
      let out = q;
      if (filters.statusId) out = out.eq('status_id', filters.statusId);
      if (filters.starGrade) out = out.eq('star_grade', Number(filters.starGrade));
      if (filters.sourceId) out = out.eq('source_id', filters.sourceId);
      if (filters.sourcerId) out = out.eq('sourcer_id', filters.sourcerId);
      if (filters.dateFrom) out = out.gte('initial_date', filters.dateFrom);
      if (filters.dateTo) out = out.lte('initial_date', filters.dateTo);
      for (const word of searchWords(search)) {
        out = out.ilike('search_text', `%${likeLiteral(word)}%`);
      }
      return out;
    },
    [filters, search],
  );

  const applyOrder = useCallback(
    (q: CandidateQuery): CandidateQuery => {
      const sortColumn = sort ? SORT_COLUMNS[sort.key] : undefined;
      let out = q;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('last_name', { ascending: true }).order('first_name', { ascending: true });
      }
      return out.order('person_id', { ascending: true });
    },
    [sort],
  );

  const applyFilters = useCallback(
    (q: CandidateQuery): CandidateQuery => applyOrder(applyWhere(q)),
    [applyOrder, applyWhere],
  );

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    try {
      const start = page * CANDIDATE_PAGE_SIZE;
      const { data, error: listErr } = await applyFilters(candidateBaseQuery()).range(
        start,
        start + CANDIDATE_PAGE_SIZE - 1,
      );
      if (listErr) throw new Error(listErr.message);

      if (!isCurrent()) return;
      const pageRows = data ?? [];
      setProfiles(pageRows);

      const personIds = pageRows.map((r) => r.person_id);
      if (personIds.length === 0) {
        setApps([]);
        setReqs([]);
        setError(null);
        return;
      }

      const { data: appRows, error: appErr } = await supabase
        .from('applications')
        .select('*')
        .in('person_id', personIds);
      if (appErr) throw new Error(appErr.message);
      if (!isCurrent()) return;
      setApps(appRows ?? []);

      const reqIds = [...new Set((appRows ?? []).map((a) => a.requisition_id))];
      if (reqIds.length === 0) {
        setReqs([]);
        setError(null);
        return;
      }
      const { data: reqRows, error: reqErr } = await supabase
        .from('requisitions')
        .select('*')
        .in('id', reqIds);
      if (reqErr) throw new Error(reqErr.message);
      if (!isCurrent()) return;
      setReqs(reqRows ?? []);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [applyFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [filters, search, sort]);

  const beginCount = useLatestOnly();

  const refreshCount = useCallback(
    async (blank: boolean) => {
      const isCurrent = beginCount();
      if (blank) setTotal(null);
      const { count, error: countErr } = await applyWhere(candidateCountQuery());
      if (!isCurrent()) return;
      if (countErr) {
        setError(countErr.message);
        return;
      }
      setTotal(count ?? 0);
    },
    [applyWhere, beginCount],
  );

  useEffect(() => {
    void refreshCount(true);
  }, [refreshCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadAll = useCallback(async () => {
    await load();
    await refreshCount(false);
  }, [load, refreshCount]);

  const reloadSoon = useCoalescedReload(reloadAll);

  useEffect(() => {
    const channel = realtimeChannel('recruit-candidate-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_profiles' },
        reloadSoon,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reloadSoon]);

  const reqCode = useMemo(
    () => new Map(reqs.map((r) => [r.id, r.display_code])),
    [reqs],
  );

  const canBulkEdit = !mobile && (role === 'admin' || role === 'recruiter');
  const showSkeleton = useMinimumVisible(loading);

  const canGrade = useCallback(
    (profile: CandidateListRow) =>
      !mobile &&
      (role === 'admin' ||
        role === 'recruiter' ||
        (role === 'sourcer' && staff != null && profile.sourcer_id === staff.id)),
    [role, staff, mobile],
  );

  const exportFilteredRows = useCallback(async () => {
    const { count, error: countErr } = await applyWhere(candidateCountQuery());
    if (countErr) {
      setError(countErr.message);
      return [];
    }
    const matched = count ?? 0;
    if (matched > EXPORT_ROW_CAP) {
      setError(
        `That filter matches ${matched.toLocaleString()} candidates, more than the ${EXPORT_ROW_CAP.toLocaleString()} an in-browser export can build. Narrow the filter and try again.`,
      );
      return [];
    }

    const collected: CandidateListRow[] = [];
    for (let start = 0; start < EXPORT_ROW_CAP; start += EXPORT_PAGE_SIZE) {
      const { data, error: pageErr } = await applyFilters(candidateBaseQuery()).range(
        start,
        start + EXPORT_PAGE_SIZE - 1,
      );
      if (pageErr) {
        setError(pageErr.message);
        return [];
      }
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < EXPORT_PAGE_SIZE) break;
    }

    const ids = collected.map((r) => r.person_id);
    const exportApps: Application[] = [];
    for (let i = 0; i < ids.length; i += APP_LOOKUP_CHUNK) {
      const { data, error: appErr } = await supabase
        .from('applications')
        .select('*')
        .in('person_id', ids.slice(i, i + APP_LOOKUP_CHUNK));
      if (appErr) {
        setError(appErr.message);
        return [];
      }
      exportApps.push(...(data ?? []));
    }

    const exportReqCode = new Map<string, string>();
    const reqIds = [...new Set(exportApps.map((a) => a.requisition_id))];
    for (let i = 0; i < reqIds.length; i += APP_LOOKUP_CHUNK) {
      const { data, error: reqErr } = await supabase
        .from('requisitions')
        .select('id, display_code')
        .in('id', reqIds.slice(i, i + APP_LOOKUP_CHUNK));
      if (reqErr) {
        setError(reqErr.message);
        return [];
      }
      for (const r of data ?? []) exportReqCode.set(r.id, r.display_code);
    }

    setError(null);
    return buildCandidateRows({ rows: collected, apps: exportApps, reqCode: exportReqCode });
  }, [applyFilters, applyWhere]);

  const rows = useMemo<CandRow[]>(
    () => buildCandidateRows({ rows: profiles, apps, reqCode }),
    [profiles, apps, reqCode],
  );

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const updateGrade = useCallback(
    async (personId: string, patch: { star_grade?: number | null; grade_comment?: string | null }) => {
      const { error: err } = await supabase
        .from('candidate_profiles')
        .update(patch)
        .eq('person_id', personId);
      if (err) setError(err.message);
      else await load();
    },
    [load],
  );

  const columns = useMemo<TableColumn<CandRow>[]>(() => {
    const defs: TableColumn<CandRow>[] = [
      {
        key: 'flags',
        header: (
          <span className="cand-flag-col" role="img" aria-label="Flags" title="Flags">
            <FlagIcon size={20} />
          </span>
        ),
        sortable: true,
        sortValue: (r) => (r.flags ? 1 : 0),
        width: '32px',
        render: (r) =>
          r.flags ? (
            <span className="cand-flag-set" role="img" aria-label={r.flags} title={r.flags}>
              <FlagIcon size={20} />
            </span>
          ) : null,
      },
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        nowrap: true,
        render: (r) => (
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              openRecord(`/recruit/candidates/${r.id}`, pageIds);
            }}
          >
            {r.name}
          </button>
        ),
      },
      {
        key: 'updated_at',
        header: 'Last updated',
        sortable: true,
        render: (r) => fmtDate(r.updated_at),
      },
      {
        key: 'has_resume',
        header: 'Resume',
        sortable: true,
        align: 'center',
        sortValue: (r) => (r.has_resume ? 1 : 0),
        render: (r) => (
          <span
            className={r.has_resume ? 'cand-resume-icon' : 'cand-resume-icon cand-resume-none'}
            role="img"
            aria-label={
              r.has_resume ? `Resume on file for ${r.name}` : `No resume on file for ${r.name}`
            }
            title={r.has_resume ? 'Resume on file' : 'No resume on file'}
          >
            <ResumeIcon size={20} />
          </span>
        ),
      },
      { key: 'location', header: 'Location', sortable: true, minWidth: '200px' },
      { key: 'source', header: 'Source', sortable: true },
      {
        key: 'initial_date',
        header: 'Initial date',
        sortable: true,
        render: (r) => fmtDate(r.initial_date),
      },
      {
        key: 'star_grade',
        width: '92px',
        header: 'Grade',
        sortable: true,
        sortValue: (r) => r.star_grade ?? 0,
        render: (r) => {
          const prof = profiles.find((p) => p.person_id === r.id);
          return prof && canGrade(prof) ? (
            <StarGrade
              value={r.star_grade}
              subject={r.name}
              onChange={(v) => void updateGrade(r.id, { star_grade: v })}
            />
          ) : (
            <StarGrade value={r.star_grade} subject={r.name} />
          );
        },
      },
      {
        key: 'grade_comment',
        header: 'Grade comment',
        sortable: true,
        render: (r) => {
          const prof = profiles.find((p) => p.person_id === r.id);
          return (
            <span className="grade-comment-cell" onClick={(e) => e.stopPropagation()}>
              <span className="grade-comment-text">
                {r.grade_comment ? <CappedCell text={r.grade_comment} /> : EMPTY_CELL}
              </span>
              {prof && canGrade(prof) && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Edit grade comment for ${r.name}`}
                  onClick={() => {
                    setCommentDraft(prof.grade_comment ?? '');
                    setCommentEdit(prof);
                  }}
                >
                  Edit
                </Button>
              )}
            </span>
          );
        },
      },
      { key: 'status', header: 'Main status', sortable: true },
      {
        key: 'requisitions',
        header: 'Requisitions',
        sortable: true,
        render: (r) => (
          <span className="chip-row">
            {r.requisitions
              .split(', ')
              .filter(Boolean)
              .map((code) => (
                <span key={code} className="chip">
                  {code}
                </span>
              ))}
          </span>
        ),
      },
      { key: 'current_title', header: 'Current title', sortable: true },
      { key: 'current_employer', header: 'Current employer', sortable: true },
      { key: 'sourcer', header: 'Sourcer', sortable: true, nowrap: true },
    ];
    const byKey = new Map(defs.map((c) => [c.key, c]));
    return visibleCols
      .map((key) => byKey.get(key))
      .filter((c): c is TableColumn<CandRow> => c !== undefined);
  }, [visibleCols, profiles, canGrade, updateGrade, openRecord, pageIds]);

  const pageCount =
    total === null
      ? page + (profiles.length === CANDIDATE_PAGE_SIZE ? 2 : 1)
      : Math.max(1, Math.ceil(total / CANDIDATE_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    totalPending: total === null,
    from: profiles.length === 0 ? 0 : page * CANDIDATE_PAGE_SIZE + 1,
    to:
      total === null
        ? page * CANDIDATE_PAGE_SIZE + profiles.length
        : Math.min(total, (page + 1) * CANDIDATE_PAGE_SIZE),
    pageRows: rows,
  };

  const currentState = useCallback(
    (): ViewState => ({
      filters: { ...filters } as unknown as Record<string, string>,
      columns: visibleCols,
      sort,
    }),
    [filters, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    setFilters({ ...EMPTY_FILTERS, ...(state.filters as Partial<CandFilters>) });
    if (state.columns.length > 0) {
      const saved = state.columns.filter((k) => ALL_COLUMN_KEYS.includes(k));
      setColumnOrder([...saved, ...ALL_COLUMN_KEYS.filter((k) => !saved.includes(k))]);
      setHiddenCols(ALL_COLUMN_KEYS.filter((k) => !saved.includes(k)));
    }
    setSort(state.sort);
  }, []);

  const columnHeader = useMemo(
    () => new Map(COLUMN_DEFS.map((c) => [c.key, c.header])),
    [],
  );
  const exportColumns = visibleCols.map((key) => ({
    key,
    header: columnHeader.get(key) ?? key,
  }));

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Candidates' }]}
      flush
      title="Candidates"
      icon={<PersonIcon size={32} />}
      description="Candidates are all of the people you want to track in Front Office OS who are either applicants, employee referrals, sourced prospects, agency submissions, etc."
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchPlaceholder="Search name, email, title, employer…"
      searchHints={candidateSearchHints}
      actions={
        <SettingsButton
          label="Column settings"
          title="Choose the column order and which columns show"
          onClick={() => setSettingsOpen(true)}
        />
      }
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
      exportRows={exportFilteredRows}
      exportCount={total ?? profiles.length}
      exportColumns={exportColumns}
      exportFilename="candidates.csv"
      bulkBarOpen={selected.size > 0}
      bulkBar={
        <div className="record-action-bar fo-list-action-bar">
          <CandidateBulkActions
            selected={selected}
            profiles={profiles}
            statuses={lookups.statuses}
            canEdit={canBulkEdit}
            onDone={load}
            onClear={() => setSelected(new Set())}
          />
          <PlaceholderAction
            label="View Resume"
            size="sm"
            lead="Opening resumes for a whole selection is still in development."
            detail="Open a candidate and use View Resume there, or use the Resume column to see who has one on file."
          />
          <PlaceholderAction
            label="Print profile"
            size="sm"
            lead="Printing a whole selection is still in development."
            detail="Open a candidate and use Print profile there to print one."
          />
          <PlaceholderAction
            label="Submit"
            size="sm"
            lead="Submitting a whole selection is still in development."
            detail="Open a candidate and use Submit there to put one forward on a requisition."
          />
          <PlaceholderAction label="More" size="sm" caret />
        </div>
      }
      filterRail={
        <CandidateFilterRail
          lookups={lookups}
          filters={filters}
          setFilters={setFilters}
          setSort={setSort}
          hiddenCols={hiddenCols}
          setHiddenCols={setHiddenCols}
          setColumnOrder={setColumnOrder}
        />
      }
    >
      {(error || savedViews.error) && (
        <p className="form-error" role="alert">{error ?? savedViews.error}</p>
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        totalPending={pager.totalPending}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      {showSkeleton ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading candidates" />
        </div>
      ) : (
      <Table
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.id}
        rowName={(r) => r.name}
        busy={loading}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        onRowClick={(r) => openRecord(`/recruit/candidates/${r.id}`, pageIds)}
        emptyText="No candidates match."
        emptyIcon={<PersonIcon size={32} />}
      />
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        totalPending={pager.totalPending}
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
            setHiddenCols(ALL_COLUMN_KEYS.filter((k) => !DEFAULT_COLUMN_KEYS.includes(k)));
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {commentEdit && (
        <Dialog
          title="Grade comment"
          onClose={() => setCommentEdit(null)}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  void updateGrade(commentEdit.person_id, {
                    grade_comment: commentDraft.trim() || null,
                  });
                  setCommentEdit(null);
                }}
              >
                Save
              </Button>
            </>
          )}
        >
          <textarea
            rows={4}
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            aria-label="Grade comment"
            autoFocus
          />
        </Dialog>
      )}
    </ListPage>
  );
}
