import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../../auth/SessionProvider';
import {
  APPLICATION_STAGES,
  type ApplicationStage,
} from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { StatusBadge } from '../../../components/ui/Badge';
import { UnviewedBadge } from '../../../components/ui/UnviewedBadge';
import { Table, CappedCell, type TableColumn } from '../../../components/ui/Table';
import { KanbanBoard } from '../../../components/ui/KanbanBoard';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { Pager } from '../../../components/ui/Pager';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { Table2 as TableIcon, Columns3 as KanbanIcon } from 'lucide-react';
import { downloadCsv } from '../../../lib/csv';
import { Dialog } from '../components/Dialog';
import { AddCandidateDialog } from './AddCandidateDialog';
import { realtimeChannel } from '../../../lib/realtimeChannel';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import type { Database } from '../../../lib/database.types';
import { type Requisition, errMsg, fmtDate } from '../lib';
import { type CompanyOption } from '../hooks';

interface PipelineProps {
  requisition: Requisition;
  companies: CompanyOption[];

  canEdit: boolean;

  mobile: boolean;

  addSignal?: number;
}

const CARDS_PER_STAGE = 25;
const TABLE_PAGE_SIZE = 25;

const PIPELINE_COLUMNS =
  'id, display_code, requisition_id, person_id, stage, next_step, rejection_reason, is_shortlisted, rank, source_id, applied_at, stage_changed_at, candidate_name, source_name, unviewed, stage_rank';

type PipelineViewRow = Pick<
  Database['public']['Views']['application_pipeline']['Row'],
  | 'id'
  | 'display_code'
  | 'requisition_id'
  | 'person_id'
  | 'stage'
  | 'next_step'
  | 'rejection_reason'
  | 'is_shortlisted'
  | 'rank'
  | 'source_id'
  | 'applied_at'
  | 'stage_changed_at'
  | 'candidate_name'
  | 'source_name'
  | 'unviewed'
  | 'stage_rank'
>;
type StageSummaryRow = Database['public']['Views']['application_stage_summary']['Row'];

const TABLE_SORT_COLUMNS: Record<string, string> = {
  name: 'candidate_name',
  stage: 'stage',
  next_step: 'next_step',
  rank: 'rank',
  source: 'source_name',
  applied_at: 'applied_at',
  stage_changed_at: 'stage_changed_at',
};

interface AppRow extends Record<string, unknown> {
  id: string;
  person_id: string;
  name: string;
  stage: ApplicationStage;
  next_step: string;
  is_shortlisted: boolean;
  rank: number | null;
  source: string;
  applied_at: string;
  stage_changed_at: string;
  rejection_reason: string;
  unviewed: boolean;
}

const EXPORT_COLUMNS = [
  { key: 'name', header: 'Candidate' },
  { key: 'stage', header: 'Stage' },
  { key: 'next_step', header: 'Next step' },
  { key: 'is_shortlisted', header: 'Shortlisted' },
  { key: 'rank', header: 'Rank' },
  { key: 'source', header: 'Source' },
  { key: 'applied_at', header: 'Applied' },
  { key: 'stage_changed_at', header: 'Stage changed' },
  { key: 'rejection_reason', header: 'Rejection reason' },
];

export function ApplicationPipeline({
  requisition,
  companies,
  canEdit,
  mobile,
  addSignal,
}: PipelineProps) {
  const navigate = useNavigate();
  const { staff } = useSession();
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const [viewRows, setViewRows] = useState<PipelineViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<StageSummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<PipelineViewRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [promoteTarget, setPromoteTarget] = useState<PipelineViewRow | null>(null);
  const [promoteCompanyId, setPromoteCompanyId] = useState('');
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editRowFields, setEditRowFields] = useState(false);

  useEffect(() => {
    if (addSignal) setAdding(true);
  }, [addSignal]);

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    try {
      const summaryQuery = supabase
        .from('application_stage_summary')
        .select('requisition_id, stage, application_count, unviewed_count')
        .eq('requisition_id', requisition.id);

      const cardQuery = supabase
        .from('application_pipeline')
        .select(PIPELINE_COLUMNS)
        .eq('requisition_id', requisition.id)
        .lte('stage_rank', CARDS_PER_STAGE)
        .order('stage', { ascending: true })
        .order('stage_rank', { ascending: true });

      const sortColumn = sort ? TABLE_SORT_COLUMNS[sort.key] : undefined;
      let tableQuery = supabase
        .from('application_pipeline')
        .select(PIPELINE_COLUMNS, { count: 'exact' })
        .eq('requisition_id', requisition.id);
      tableQuery = sortColumn
        ? tableQuery.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
        : tableQuery.order('applied_at', { ascending: false, nullsFirst: false });
      const start = page * TABLE_PAGE_SIZE;
      tableQuery = tableQuery.order('id', { ascending: true }).range(start, start + TABLE_PAGE_SIZE - 1);

      const wantCards = view === 'kanban' && !mobile;
      const sum = await summaryQuery;
      if (sum.error) throw new Error(sum.error.message);
      if (!isCurrent()) return;
      setSummary(sum.data ?? []);

      if (wantCards) {
        const cards = await cardQuery;
        if (cards.error) throw new Error(cards.error.message);
        setViewRows(cards.data ?? []);
        setTotal((sum.data ?? []).reduce((n, r) => n + Number(r.application_count ?? 0), 0));
      } else {
        const paged = await tableQuery;
        if (paged.error) throw new Error(paged.error.message);
        setViewRows(paged.data ?? []);
        setTotal(paged.count ?? 0);
      }
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [requisition.id, view, mobile, page, sort, beginLoad]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = realtimeChannel(`recruit-pipeline-${requisition.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `requisition_id=eq.${requisition.id}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requisition.id, load]);

  const rows = useMemo<AppRow[]>(
    () =>
      viewRows.map((a) => ({
        id: a.id,
        person_id: a.person_id,
        name: a.candidate_name || '\u2026',
        stage: a.stage,
        next_step: a.next_step ?? '',
        is_shortlisted: a.is_shortlisted,
        rank: a.rank,
        source: a.source_name ?? '',
        applied_at: a.applied_at,
        stage_changed_at: a.stage_changed_at,
        rejection_reason: a.rejection_reason ?? '',
        unviewed: a.unviewed,
      })),
    [viewRows],
  );

  const stageTotals = useMemo(
    () => new Map(summary.map((r) => [r.stage, Number(r.application_count ?? 0)])),
    [summary],
  );

  const totalUnviewed = useMemo(
    () => summary.reduce((n, r) => n + Number(r.unviewed_count ?? 0), 0),
    [summary],
  );

  const openCandidate = useCallback(
    async (row: AppRow) => {
      if (staff) {
        await supabase.from('application_views').upsert(
          {
            application_id: row.id,
            staff_id: staff.id,
            last_viewed_at: new Date().toISOString(),
          },
          { onConflict: 'application_id,staff_id' },
        );
      }
      navigate(`/recruit/candidates/${row.person_id}?application=${row.id}`);
    },
    [staff, navigate],
  );

  const writeStage = useCallback(
    async (
      app: PipelineViewRow,
      stage: ApplicationStage,
      extra: Partial<{ rejection_reason: string; hired_at: string }> = {},
    ) => {
      const { error: err } = await supabase
        .from('applications')
        .update({
          stage,
          stage_changed_at: new Date().toISOString(),
          ...extra,
        })
        .eq('id', app.id);
      if (err) {
        setError(err.message);
        return false;
      }
      await load();
      return true;
    },
    [load],
  );

  const moveStage = useCallback(
    (appId: string, toStage: string) => {
      if (!canEdit) return;
      const app = viewRows.find((a) => a.id === appId);
      if (!app || app.stage === toStage) return;
      const stage = toStage as ApplicationStage;
      if (stage === 'rejected') {
        setRejectReason('');
        setRejectTarget(app);
        return;
      }
      if (stage === 'hired') {
        if (requisition.status !== 'open') {
          setError('Hiring requires the requisition to be open.');
          return;
        }
        void writeStage(app, 'hired', { hired_at: new Date().toISOString() }).then(
          (ok) => {
            if (ok) {
              setPromoteCompanyId(requisition.company_id ?? '');
              setPromoteMsg(null);
              setPromoteTarget(app);
            }
          },
        );
        return;
      }
      void writeStage(app, stage);
    },
    [viewRows, canEdit, requisition.status, requisition.company_id, writeStage],
  );

  const confirmReject = useCallback(() => {
    if (!rejectTarget || !rejectReason.trim()) return;
    void writeStage(rejectTarget, 'rejected', {
      rejection_reason: rejectReason.trim(),
    }).then((ok) => {
      if (ok) setRejectTarget(null);
    });
  }, [rejectTarget, rejectReason, writeStage]);

  const createContactProfile = useCallback(async () => {
    if (!promoteTarget) return;
    const { error: err } = await supabase.from('contact_profiles').upsert(
      {
        person_id: promoteTarget.person_id,
        company_id: promoteCompanyId || null,
      },
      { onConflict: 'person_id' },
    );
    if (err) {
      setPromoteMsg(`Could not create contact profile: ${err.message}`);
    } else {
      setPromoteMsg('Contact profile created — the person now appears in CRM.');
    }
  }, [promoteTarget, promoteCompanyId]);

  const toggleShortlist = useCallback(
    async (row: AppRow) => {
      if (!canEdit) return;
      const { error: err } = await supabase
        .from('applications')
        .update({ is_shortlisted: !row.is_shortlisted })
        .eq('id', row.id);
      if (err) setError(err.message);
      else await load();
    },
    [canEdit, load],
  );

  const setRank = useCallback(
    async (row: AppRow, value: string) => {
      if (!canEdit) return;
      const rank = value === '' ? null : parseInt(value, 10);
      if (rank !== null && Number.isNaN(rank)) return;
      const { error: err } = await supabase
        .from('applications')
        .update({ rank })
        .eq('id', row.id);
      if (err) setError(err.message);
      else await load();
    },
    [canEdit, load],
  );

  const setNextStep = useCallback(
    async (row: AppRow, value: string) => {
      if (!canEdit || value === row.next_step) return;
      const { error: err } = await supabase
        .from('applications')
        .update({ next_step: value.trim() || null })
        .eq('id', row.id);
      if (err) setError(err.message);
      else await load();
    },
    [canEdit, load],
  );

  const columns = useMemo<TableColumn<AppRow>[]>(
    () => [
      {
        key: 'name',
        header: 'Candidate',
        render: (r) => (
          <span>
            {r.unviewed && <span className="unviewed-dot" role="img" aria-label="Unviewed" />}{' '}
            <button
              type="button"
              className="link-btn"
              onClick={(e) => {
                e.stopPropagation();
                void openCandidate(r);
              }}
            >
              {r.name}
            </button>
          </span>
        ),
      },
      {
        key: 'stage',
        header: 'Stage',
        sortValue: (r) => APPLICATION_STAGES.indexOf(r.stage),
        render: (r) => <StatusBadge status={r.stage} />,
      },
      {
        key: 'next_step',
        hideWhenEmpty: true,
        header: 'Next step',
        render: (r) =>
          canEdit && editRowFields ? (
            <span className="next-step-input" onClick={(e) => e.stopPropagation()}>
              <Input
                key={`${r.id}-${r.next_step}`}
                defaultValue={r.next_step}
                aria-label={`Next step for ${r.name}`}
                onBlur={(e) => void setNextStep(r, e.target.value)}
              />
            </span>
          ) : (
            r.next_step
          ),
      },
      {
        key: 'is_shortlisted',
        hideWhenEmpty: true,
        header: 'Shortlist',
        sortValue: (r) => (r.is_shortlisted ? 1 : 0),
        render: (r) => (
          <button
            type="button"
            className={r.is_shortlisted ? 'shortlist-btn on' : 'shortlist-btn'}
            title="Shortlist (ACE flag)"
            aria-label={
              r.is_shortlisted
                ? `Remove ${r.name} from shortlist`
                : `Add ${r.name} to shortlist`
            }
            onClick={(e) => {
              e.stopPropagation();
              void toggleShortlist(r);
            }}
          >
            <Star size={20} fill={r.is_shortlisted ? 'currentColor' : 'none'} />
          </button>
        ),
      },
      {
        key: 'rank',
        hideWhenEmpty: true,
        header: 'Rank',
        sortValue: (r) => r.rank ?? 9999,
        render: (r) =>
          canEdit && editRowFields ? (
            <span className="rank-input" onClick={(e) => e.stopPropagation()}>
              <Input
                key={`${r.id}-${r.rank ?? ''}`}
                type="number"
                min={1}
                defaultValue={r.rank ?? ''}
                aria-label={`Rank for ${r.name}`}
                onBlur={(e) => void setRank(r, e.target.value)}
              />
            </span>
          ) : (
            (r.rank ?? '')
          ),
      },
      { key: 'source', header: 'Source', hideWhenEmpty: true },
      {
        key: 'applied_at',
        header: 'Applied',
        render: (r) => fmtDate(r.applied_at),
      },
      {
        key: 'stage_changed_at',
        header: 'Stage changed',
        render: (r) => fmtDate(r.stage_changed_at),
      },
      {
        key: 'rejection_reason',
        hideWhenEmpty: true,
        header: 'Rejection reason',
        render: (r) => <CappedCell text={r.rejection_reason} />,
      },
    ],
    [canEdit, editRowFields, openCandidate, toggleShortlist, setRank, setNextStep],
  );

  const kanbanCards = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        stage: r.stage,
        content: (
          <div>
            <button
              type="button"
              className="kanban-card-name"
              onClick={() => void openCandidate(r)}
            >
              {r.name}
            </button>
            <div className="kanban-card-meta">
              {r.unviewed && <span className="unviewed-dot" role="img" aria-label="Unviewed" />}
              <button
                type="button"
                className={r.is_shortlisted ? 'shortlist-btn on' : 'shortlist-btn'}
                title="Shortlist (ACE flag)"
                aria-label={
                  r.is_shortlisted
                    ? `Remove ${r.name} from shortlist`
                    : `Add ${r.name} to shortlist`
                }
                onClick={() => void toggleShortlist(r)}
              >
                <Star size={20} fill={r.is_shortlisted ? 'currentColor' : 'none'} />
              </button>
              {r.rank != null && <span>#{r.rank}</span>}
              {r.next_step && <span>{r.next_step}</span>}
              {r.source && <span>{r.source}</span>}
            </div>
          </div>
        ),
      })),
    [rows, openCandidate, toggleShortlist],
  );

  const unviewedByStage = useMemo(
    () => new Map(summary.map((r) => [r.stage, Number(r.unviewed_count ?? 0)])),
    [summary],
  );

  const showKanban = view === 'kanban' && !mobile;
  const promotePersonName = promoteTarget?.candidate_name || 'This person';

  return (
    <div>
      <div className="pipeline-head">
        <h2>Applications ({rows.length})</h2>
        <UnviewedBadge count={totalUnviewed} />
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add candidate
          </Button>
        )}
        <ActionMenu
          label="More pipeline actions"
          iconOnly
          items={[
            ...(canEdit
              ? [
                  {
                    label: editRowFields ? 'Done editing' : 'Edit next step and rank',
                    onSelect: () => setEditRowFields((v) => !v),
                  },
                ]
              : []),
            {
              label: 'Export CSV',
              disabled: rows.length === 0,
              onSelect: () =>
                downloadCsv(
                  `${requisition.display_code}-applications.csv`,
                  rows,
                  EXPORT_COLUMNS,
                ),
            },
          ]}
        />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="fo-list-toolbar">
        {!mobile && <SegmentedToggle
          className="rq-pipeline-view"
          ariaLabel="Pipeline view"
          value={view}
          onChange={setView}
          options={[
            { value: 'table', label: '', title: 'Table', icon: <TableIcon size={20} aria-hidden="true" /> },
            { value: 'kanban', label: '', title: 'Kanban', icon: <KanbanIcon size={20} aria-hidden="true" /> },
          ]}
        />}
        <Pager
          from={total === 0 ? 0 : page * TABLE_PAGE_SIZE + 1}
          to={Math.min(total, (page + 1) * TABLE_PAGE_SIZE)}
          total={total}
          page={page}
          pageCount={Math.max(1, Math.ceil(total / TABLE_PAGE_SIZE))}
          onPage={setPage}
          disabled={showKanban}
        />
      </div>

      {showKanban ? (
        <KanbanBoard
          stages={APPLICATION_STAGES.map((s) => ({
            key: s,
            label: s.replace(/_/g, ' '),
          }))}
          cards={kanbanCards}
          onMove={moveStage}
          columnExtras={(stageKey) => {
            const stage = stageKey as ApplicationStage;
            const shown = rows.filter((r) => r.stage === stage).length;
            const stageTotal = stageTotals.get(stage) ?? 0;
            return (
              <>
                <UnviewedBadge count={unviewedByStage.get(stage) ?? 0} />
                {stageTotal > shown && (
                  <span className="text-secondary sales-kanban-more">
                    {`showing ${shown} of ${stageTotal.toLocaleString()}`}
                  </span>
                )}
              </>
            );
          }}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            busy={loading}
            onRowClick={(r) => void openCandidate(r)}
            emptyText="No applications yet."
            sortKey={sort?.key ?? null}
            sortDir={sort?.dir ?? 'asc'}
            onSortChange={(key, dir) => {
              if (!TABLE_SORT_COLUMNS[key]) return;
              setSort({ key, dir });
              setPage(0);
            }}
          />
        </>
      )}

      {rejectTarget && (
        <Dialog
          title="Reject application"
          onClose={() => setRejectTarget(null)}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!rejectReason.trim()}
                onClick={confirmReject}
              >
                Reject
              </Button>
            </>
          )}
        >
          <p>
            A rejection reason is required before{' '}
            {rejectTarget.candidate_name || 'this candidate'}{' '}
            moves to rejected.
          </p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            aria-label="Rejection reason"
            placeholder="Rejection reason (required)"
            autoFocus
          />
        </Dialog>
      )}

      {promoteTarget && (
        <Dialog
          title="Candidate hired — promote to contact?"
          onClose={() => setPromoteTarget(null)}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>{promoteMsg ? 'Close' : 'Not now'}</Button>
              {!promoteMsg && (
                <Button variant="primary" onClick={() => void createContactProfile()}>
                  Create contact profile
                </Button>
              )}
            </>
          )}
        >
          <p>
            {promotePersonName} was hired on{' '}
            {requisition.display_code}. Create a contact profile so they carry over
            to CRM — one person, one identity.
          </p>
          <Select
            label="Contact company"
            placeholder="No company"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={promoteCompanyId}
            onChange={(e) => setPromoteCompanyId(e.target.value)}
          />
          {promoteMsg && <p className="text-secondary">{promoteMsg}</p>}
        </Dialog>
      )}

      {adding && (
        <AddCandidateDialog
          requisition={requisition}
          onClose={() => setAdding(false)}
          onAdded={async () => {
            setAdding(false);
            await load();
          }}
          onDuplicate={(app) => {
            setAdding(false);
            setError(
              'Already in this pipeline — showing the existing application.',
            );
            void openCandidate({ id: app.id, person_id: app.person_id } as AppRow);
          }}
        />
      )}
    </div>
  );
}
