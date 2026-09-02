import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useListLink } from '../../../lib/listReturn';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
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
import {
  errMsg,
  fetchPeopleByIds,
  fmtDate,
  personEmails,
  personName,
  sortRows,
  supabase,
  useIsMobile,
  useLookups,
  type Application,
  type CandidateProfile,
  type Person,
  type Requisition,
  type SortState,
} from '../lib/data';
import { SavedViewsControl, useSavedViews, type ViewState } from '../lib/savedViews';

interface CandFilters {
  statusId: string;
  starGrade: string;
  sourceId: string;
  sourcerId: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: CandFilters = {
  statusId: '',
  starGrade: '',
  sourceId: '',
  sourcerId: '',
  dateFrom: '',
  dateTo: '',
};

interface CandRow extends Record<string, unknown> {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  updated_at: string;
  has_resume: boolean;
  location: string;
  star_grade: number | null;
  grade_comment: string;
  current_title: string;
  current_employer: string;
  status: string;
  source: string;
  initial_date: string;
  sourcer: string;
  requisitions: string;
  flags: string;
  emails: string;
}

const COLUMN_DEFS: { key: keyof CandRow & string; header: string }[] = [
  { key: 'name', header: 'Name' },
  { key: 'updated_at', header: 'Last updated' },
  { key: 'has_resume', header: 'Resume' },
  { key: 'location', header: 'Location' },
  { key: 'source', header: 'Source' },
  { key: 'initial_date', header: 'Initial date' },
  { key: 'star_grade', header: 'Grade' },
  { key: 'grade_comment', header: 'Grade comment' },
  { key: 'status', header: 'Main status' },
  { key: 'requisitions', header: 'Requisitions' },
  { key: 'current_title', header: 'Current title' },
  { key: 'current_employer', header: 'Current employer' },
  { key: 'sourcer', header: 'Sourcer' },
  { key: 'flags', header: 'Flags' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

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

  const [profiles, setProfiles] = useState<CandidateProfile[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [resumePersonIds, setResumePersonIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [commentEdit, setCommentEdit] = useState<CandidateProfile | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [prof, a, r, att] = await Promise.all([
        supabase.from('candidate_profiles').select('*'),
        supabase.from('applications').select('*'),
        supabase.from('requisitions').select('*'),
        supabase
          .from('attachments')
          .select('parent_id')
          .eq('parent_type', 'person')
          .eq('kind', 'resume'),
      ]);
      const firstError = prof.error ?? a.error ?? r.error ?? att.error ?? null;
      if (firstError) throw new Error(firstError.message);
      const profRows = prof.data ?? [];
      setProfiles(profRows);
      setApps(a.data ?? []);
      setReqs(r.data ?? []);
      setResumePersonIds(new Set((att.data ?? []).map((x) => x.parent_id)));
      const persons = await fetchPeopleByIds(profRows.map((p) => p.person_id));
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

  const canGrade = useCallback(
    (profile: CandidateProfile) =>
      !mobile &&
      (role === 'admin' ||
        role === 'recruiter' ||
        (role === 'sourcer' && staff != null && profile.sourcer_id === staff.id)),
    [role, staff, mobile],
  );

  const rows = useMemo<CandRow[]>(() => {
    const appsByPerson = new Map<string, Application[]>();
    for (const a of apps) {
      const list = appsByPerson.get(a.person_id) ?? [];
      list.push(a);
      appsByPerson.set(a.person_id, list);
    }
    return profiles.map((prof) => {
      const p = people.get(prof.person_id);
      const flags: string[] = [];
      if (prof.do_not_contact) flags.push('Do not contact');
      return {
        id: prof.person_id,
        name: p ? personName(p) : '…',
        first_name: p?.first_name ?? '',
        last_name: p?.last_name ?? '',
        updated_at: p?.updated_at ?? '',
        has_resume: resumePersonIds.has(prof.person_id),
        location: p
          ? [p.city, p.state, p.country].filter(Boolean).join(', ')
          : '',
        star_grade: prof.star_grade,
        grade_comment: prof.grade_comment ?? '',
        current_title: prof.current_title ?? '',
        current_employer: prof.current_employer ?? '',

        status: prof.status_id ? (statusLabel.get(prof.status_id) ?? '') : '',
        source: prof.source_id ? (sourceName.get(prof.source_id) ?? '') : '',
        initial_date: prof.initial_date ?? '',
        sourcer: prof.sourcer_id ? (staffName.get(prof.sourcer_id) ?? '') : '',
        requisitions: (appsByPerson.get(prof.person_id) ?? [])
          .map((a) => reqCode.get(a.requisition_id) ?? '')
          .filter(Boolean)
          .join(', '),
        flags: flags.join(' · '),
        emails: p
          ? personEmails(p)
              .map((e) => e.address)
              .join(' ')
          : '',
      };
    });
  }, [profiles, people, apps, statusLabel, sourceName, staffName, reqCode, resumePersonIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = rows.filter((r) => {
      const prof = profiles.find((p) => p.person_id === r.id);
      if (!prof) return false;
      if (filters.statusId && prof.status_id !== filters.statusId) return false;
      if (filters.starGrade && String(prof.star_grade ?? '') !== filters.starGrade) {
        return false;
      }
      if (filters.sourceId && prof.source_id !== filters.sourceId) return false;
      if (filters.sourcerId && prof.sourcer_id !== filters.sourcerId) return false;
      if (
        filters.dateFrom &&
        (!prof.initial_date || prof.initial_date < filters.dateFrom)
      ) {
        return false;
      }
      if (
        filters.dateTo &&
        (!prof.initial_date || prof.initial_date > filters.dateTo)
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${r.name} ${r.emails} ${r.current_title} ${r.current_employer}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (
        firstName.trim() &&
        !r.first_name.toLowerCase().includes(firstName.trim().toLowerCase())
      ) {
        return false;
      }
      if (
        lastName.trim() &&
        !r.last_name.toLowerCase().includes(lastName.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
    return sortRows(base, sort);
  }, [rows, profiles, filters, search, sort, firstName, lastName]);

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
        <span className="cand-flag-col" aria-label="Flag" title="Flag">
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
      title="Candidates: Home"
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
        />
      }
      exportRows={filtered}
      exportColumns={exportColumns}
      exportFilename="candidates.csv"
      filterRail={
        <details className="fo-advanced-search" open>
          <summary>Advanced Search</summary>
          <div className="fo-advanced-search-body">
          <Select
            label="Status"
            placeholder="All statuses"
            options={lookups.statuses
              .filter((s) => s.is_active)
              .map((s) => ({ value: s.id, label: s.label }))}
            value={filters.statusId}
            onChange={(e) => setFilters({ ...filters, statusId: e.target.value })}
          />
          <Select
            label="Grade"
            placeholder="Any grade"
            options={[
              { value: '1', label: '1 star' },
              { value: '2', label: '2 stars' },
              { value: '3', label: '3 stars' },
            ]}
            value={filters.starGrade}
            onChange={(e) => setFilters({ ...filters, starGrade: e.target.value })}
          />
          <Select
            label="Source"
            placeholder="All sources"
            options={lookups.sources.map((s) => ({ value: s.id, label: s.name }))}
            value={filters.sourceId}
            onChange={(e) => setFilters({ ...filters, sourceId: e.target.value })}
          />
          <Select
            label="Sourcer"
            placeholder="All sourcers"
            options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
            value={filters.sourcerId}
            onChange={(e) => setFilters({ ...filters, sourcerId: e.target.value })}
          />
          <Input
            label="Initial date from"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
          />
          <Input
            label="Initial date to"
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

      <div className="record-action-bar fo-list-action-bar">
        {}
        <PlaceholderAction
          label="Send Email"
          size="sm"
          detail="Bulk email from the candidate list isn't implemented — open a candidate record to send a real email."
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
        {}
        <PlaceholderAction label="Mark as…" size="sm" caret />
        {}
        <PlaceholderAction label="Change Main Status to…" size="sm" caret />
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
          footer={
            <>
              <Button onClick={() => setCommentEdit(null)}>Cancel</Button>
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
          }
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
