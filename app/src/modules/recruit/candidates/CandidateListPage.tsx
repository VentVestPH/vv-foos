import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListLink } from '../../../lib/listReturn';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, CappedCell, type TableColumn } from '../../../components/ui/Table';
import { Pager, usePagination } from '../../../components/ui/Pager';
import { PlaceholderAction, usePlaceholder } from '../../../shell/Placeholder';
import {
  FileText as ResumeIcon,
  Flag as FlagIcon,
  Settings as GearIcon,
  User as PersonIcon,
} from 'lucide-react';
import { Dialog } from '../components/Dialog';
import { StarGrade } from '../../../components/ui/StarGrade';
import { supabase } from '../../../lib/supabase';
import {
  type Application,
  type Person,
  type Requisition,
  type SortState,
  errMsg,
  fmtDate,
} from '../lib';
import {
  ALL_COLUMN_KEYS,
  COLUMN_DEFS,
  EMPTY_FILTERS,
  buildCandidateRows,
  filterCandidateRows,
  type CandFilters,
  type CandRow,
  type CandidateListProfile,
} from './candidateRows';
import {
  CANDIDATE_LIST_COLUMNS,
  PERSON_LIST_COLUMNS,
  fetchPeopleByIds,
  useIsMobile,
  useLookups,
} from '../hooks';
import { SavedViewsControl, useSavedViews, type ViewState } from '../savedViews';
import { CandidateBulkActions } from './CandidateBulkActions';
import { CandidateFilterRail } from './CandidateFilterRail';
import { fetchAllRows } from '../../../lib/fetchAll';

export function CandidateListPage() {
  const openRecord = useListLink();
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const savedViews = useSavedViews('candidate');
  const [params] = useSearchParams();

  const [search, setSearch] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [filters, setFilters] = useState<CandFilters>(() => ({
    statusId: params.get('status') ?? '',
    starGrade: params.get('star_grade') ?? '',
    sourceId: params.get('source_id') ?? '',
    sourcerId: params.get('sourcer_id') ?? '',
    dateFrom: params.get('date_from') ?? '',
    dateTo: params.get('date_to') ?? '',
  }));
  const [sort, setSort] = useState<SortState | null>(null);
  const [visibleCols, setVisibleCols] = useState<string[]>(ALL_COLUMN_KEYS);

  const [profiles, setProfiles] = useState<CandidateListProfile[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [resumePersonIds, setResumePersonIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [commentEdit, setCommentEdit] = useState<CandidateListProfile | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [profRows, appRows, reqRows, attRows] = await Promise.all([
        fetchAllRows((f, t) =>
          supabase.from('candidate_profiles').select(CANDIDATE_LIST_COLUMNS).range(f, t),
        ),
        fetchAllRows((f, t) => supabase.from('applications').select('*').range(f, t)),
        fetchAllRows((f, t) => supabase.from('requisitions').select('*').range(f, t)),
        fetchAllRows((f, t) =>
          supabase
            .from('attachments')
            .select('parent_id')
            .eq('parent_type', 'person')
            .eq('kind', 'resume')
            .range(f, t),
        ),
      ]);
      setProfiles(profRows);
      setApps(appRows);
      setReqs(reqRows);
      setResumePersonIds(new Set(attRows.map((x) => x.parent_id)));
      const persons = await fetchPeopleByIds(
        profRows.map((p) => p.person_id),
        PERSON_LIST_COLUMNS,
      );
      setPeople(new Map(persons.map((p) => [p.id, p] as [string, Person])));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('recruit-candidate-list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidate_profiles' },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const statusLabel = useMemo(
    () => new Map(lookups.statuses.map((s) => [s.id, s.label])),
    [lookups.statuses],
  );
  const sourceName = useMemo(
    () => new Map(lookups.sources.map((s) => [s.id, s.name])),
    [lookups.sources],
  );
  const staffName = useMemo(
    () => new Map(lookups.staff.map((s) => [s.id, s.full_name])),
    [lookups.staff],
  );
  const reqCode = useMemo(
    () => new Map(reqs.map((r) => [r.id, r.display_code])),
    [reqs],
  );

  const canBulkEdit = !mobile && (role === 'admin' || role === 'recruiter');

  const canGrade = useCallback(
    (profile: CandidateListProfile) =>
      !mobile &&
      (role === 'admin' ||
        role === 'recruiter' ||
        (role === 'sourcer' && staff != null && profile.sourcer_id === staff.id)),
    [role, staff, mobile],
  );

  const rows = useMemo<CandRow[]>(
    () =>
      buildCandidateRows({
        profiles,
        people,
        apps,
        statusLabel,
        sourceName,
        staffName,
        reqCode,
        resumePersonIds,
      }),
    [profiles, people, apps, statusLabel, sourceName, staffName, reqCode, resumePersonIds],
  );

  const filtered = useMemo(
    () => filterCandidateRows({ rows, profiles, filters, search, firstName, lastName, sort }),
    [rows, profiles, filters, search, sort, firstName, lastName],
  );

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
    const flagCol: TableColumn<CandRow> = {
      key: 'flagcol',
      header: (
        <span className="cand-flag-col" role="img" aria-label="Flag" title="Flag">
          <FlagIcon size={14} />
        </span>
      ),
      width: '32px',
      render: () => null,
    };
    const defs: TableColumn<CandRow>[] = [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (r) => (
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/recruit/candidates/${r.id}`);
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
        sortValue: (r) => (r.has_resume ? 1 : 0),
        render: (r) => (
          <span
            className={r.has_resume ? 'cand-resume-icon' : 'cand-resume-icon cand-resume-none'}
            role="img"
            aria-label={r.has_resume ? 'Resume on file' : 'No resume on file'}
            title={r.has_resume ? 'Resume on file' : 'No resume on file'}
          >
            <ResumeIcon size={16} />
          </span>
        ),
      },
      { key: 'location', header: 'Location', sortable: true },
      { key: 'source', header: 'Source', sortable: true },
      {
        key: 'initial_date',
        header: 'Initial date',
        sortable: true,
        render: (r) => fmtDate(r.initial_date),
      },
      {
        key: 'star_grade',
        header: 'Grade',
        sortable: true,
        sortValue: (r) => r.star_grade ?? 0,
        render: (r) => {
          const prof = profiles.find((p) => p.person_id === r.id);
          return prof && canGrade(prof) ? (
            <StarGrade
              value={r.star_grade}
              onChange={(v) => void updateGrade(r.id, { star_grade: v })}
            />
          ) : (
            <StarGrade value={r.star_grade} />
          );
        },
      },
      {
        key: 'grade_comment',
        header: 'Grade comment',
        render: (r) => {
          const prof = profiles.find((p) => p.person_id === r.id);
          return (
            <span className="grade-comment-cell" onClick={(e) => e.stopPropagation()}>
              <CappedCell text={r.grade_comment} />
              {prof && canGrade(prof) && (
                <Button
                  size="sm"
                  variant="ghost"
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
      { key: 'sourcer', header: 'Sourcer', sortable: true },
      {
        key: 'flags',
        header: 'Flags',
        render: (r) =>
          r.flags ? (
            <Badge tone={r.flags.includes('Do not contact') ? 'danger' : 'warning'}>
              {r.flags}
            </Badge>
          ) : null,
      },
    ];
    return [flagCol, ...defs.filter((c) => visibleCols.includes(c.key))];
  }, [visibleCols, profiles, canGrade, updateGrade, navigate]);

  const pager = usePagination(filtered);

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
    if (state.columns.length > 0) setVisibleCols(state.columns);
    setSort(state.sort);
  }, []);

  const exportColumns = COLUMN_DEFS.filter((c) => visibleCols.includes(c.key));

  return (
    <ListPage
      title="Candidates"
      icon={<PersonIcon size={40} />}
      description="Candidates are all of the people you want to track in Front Office OS who are either applicants, employee referrals, sourced prospects, agency submissions, etc."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search name, email, title, employer…"
      secondSearchRow={
        <div className="cand-second-search-fields">
          <span className="fo-search-label">First Name:</span>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            aria-label="First name"
          />
          <span className="fo-search-label">Last Name:</span>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            aria-label="Last name"
          />
          {}
          <button type="button" className="btn btn-secondary btn-sm fo-go-btn">
            Go!
          </button>
        </div>
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
      exportRows={filtered}
      exportColumns={exportColumns}
      exportFilename="candidates.csv"
      filterRail={
        <CandidateFilterRail
          lookups={lookups}
          filters={filters}
          setFilters={setFilters}
          sort={sort}
          setSort={setSort}
          visibleCols={visibleCols}
          setVisibleCols={setVisibleCols}
        />
      }
    >
      {(error || savedViews.error) && (
        <p className="rq-error">{error ?? savedViews.error}</p>
      )}

      <div className="record-action-bar fo-list-action-bar">
        {}
        <CandidateBulkActions
          selected={selected}
          profiles={profiles}
          people={people}
          statuses={lookups.statuses}
          canEdit={canBulkEdit}
          onDone={load}
          onClear={() => setSelected(new Set())}
        />
        {}
        <PlaceholderAction label="View Resume" size="sm" />
        {}
        <PlaceholderAction label="Print Resume" size="sm" />
        {}
        <PlaceholderAction label="Submit" size="sm" />
        {}
        <PlaceholderAction label="More" size="sm" caret />
        <CandidateGearButton />
      </div>

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
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        onRowClick={(r) => openRecord(`/recruit/candidates/${r.id}`)}
        emptyText="No candidates match."
      />

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

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

function CandidateGearButton() {
  const { show } = usePlaceholder();
  return (
    <button
      type="button"
      className="fo-gear-btn"
      aria-label="Configure candidate list columns"
      onClick={() =>
        show(
          'Configure columns',
          'Column visibility is already available in the Advanced Search panel on this page.',
        )
      }
    >
      <GearIcon size={16} />
    </button>
  );
}
