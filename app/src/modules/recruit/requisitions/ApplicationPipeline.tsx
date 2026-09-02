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
import { downloadCsv } from '../../../lib/csv';
import { Dialog } from '../components/Dialog';
import { AddCandidateDialog } from './AddCandidateDialog';
import { supabase } from '../../../lib/supabase';
import { type Application, type Company, type Person, type Requisition, type Source, errMsg, fmtDate, personName } from '../lib';
import { fetchPeopleByIds } from '../hooks';

interface PipelineProps {
  requisition: Requisition;
  companies: Company[];
  sources: Source[];

  canEdit: boolean;

  mobile: boolean;

  addSignal?: number;
}

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
  sources,
  canEdit,
  mobile,
  addSignal,
}: PipelineProps) {
  const navigate = useNavigate();
  const { staff } = useSession();
  const [view, setView] = useState<'table' | 'kanban'>('table');

  const [apps, setApps] = useState<Application[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [viewedAt, setViewedAt] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [promoteTarget, setPromoteTarget] = useState<Application | null>(null);
  const [promoteCompanyId, setPromoteCompanyId] = useState('');
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (addSignal) setAdding(true);
  }, [addSignal]);

  const load = useCallback(async () => {
    try {
      const [a, v] = await Promise.all([
        supabase
          .from('applications')
          .select('*')
          .eq('requisition_id', requisition.id)
          .order('applied_at', { ascending: false }),
        staff
          ? supabase
              .from('application_views')
              .select('*')
              .eq('staff_id', staff.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (a.error) throw new Error(a.error.message);
      if (v.error) throw new Error(v.error.message);
      const appRows = a.data ?? [];
      setApps(appRows);
      setViewedAt(
        new Map(
          (v.data ?? []).map(
            (row) => [row.application_id, row.last_viewed_at] as [string, string],
          ),
        ),
      );
      const ids = [...new Set(appRows.map((x) => x.person_id))];
      const persons = await fetchPeopleByIds(ids);
      setPeople(new Map(persons.map((p) => [p.id, p] as [string, Person])));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [requisition.id, staff]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`recruit-pipeline-${requisition.id}`)
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

  const sourceName = useMemo(
    () => new Map(sources.map((s) => [s.id, s.name])),
    [sources],
  );

  const isUnviewed = useCallback(
    (a: Application) => {
      const seen = viewedAt.get(a.id);
      return !seen || seen < a.stage_changed_at;
    },
    [viewedAt],
  );

  const rows = useMemo<AppRow[]>(
    () =>
      apps.map((a) => {
        const p = people.get(a.person_id);
        return {
          id: a.id,
          person_id: a.person_id,
          name: p ? personName(p) : '…',
          stage: a.stage,
          next_step: a.next_step ?? '',
          is_shortlisted: a.is_shortlisted,
          rank: a.rank,
          source: a.source_id ? (sourceName.get(a.source_id) ?? '') : '',
          applied_at: a.applied_at,
          stage_changed_at: a.stage_changed_at,
          rejection_reason: a.rejection_reason ?? '',
          unviewed: isUnviewed(a),
        };
      }),
    [apps, people, sourceName, isUnviewed],
  );

  const totalUnviewed = rows.filter((r) => r.unviewed).length;

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
      app: Application,
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
      const app = apps.find((a) => a.id === appId);
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
    [apps, canEdit, requisition.status, requisition.company_id, writeStage],
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
        sortable: true,
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
        sortable: true,
        sortValue: (r) => APPLICATION_STAGES.indexOf(r.stage),
        render: (r) => <StatusBadge status={r.stage} />,
      },
      {
        key: 'next_step',
        header: 'Next step',
        render: (r) =>
          canEdit ? (
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
        header: 'Shortlist',
        sortable: true,
        sortValue: (r) => (r.is_shortlisted ? 1 : 0),
        render: (r) => (
          <button
            type="button"
            className={r.is_shortlisted ? 'shortlist-btn on' : 'shortlist-btn'}
            title="Shortlist (ACE flag)"
            aria-label={r.is_shortlisted ? 'Remove from shortlist' : 'Add to shortlist'}
            onClick={(e) => {
              e.stopPropagation();
              void toggleShortlist(r);
            }}
          >
            <Star size={14} fill={r.is_shortlisted ? 'currentColor' : 'none'} />
          </button>
        ),
      },
      {
        key: 'rank',
        header: 'Rank',
        sortable: true,
        sortValue: (r) => r.rank ?? 9999,
        render: (r) =>
          canEdit ? (
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
      { key: 'source', header: 'Source', sortable: true },
      {
        key: 'applied_at',
        header: 'Applied',
        sortable: true,
        render: (r) => fmtDate(r.applied_at),
      },
      {
        key: 'stage_changed_at',
        header: 'Stage changed',
        sortable: true,
        render: (r) => fmtDate(r.stage_changed_at),
      },
      {
        key: 'rejection_reason',
        header: 'Rejection reason',
        render: (r) => <CappedCell text={r.rejection_reason} />,
      },
    ],
    [canEdit, openCandidate, toggleShortlist, setRank, setNextStep],
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
                  r.is_shortlisted ? 'Remove from shortlist' : 'Add to shortlist'
                }
                onClick={() => void toggleShortlist(r)}
              >
                <Star size={14} fill={r.is_shortlisted ? 'currentColor' : 'none'} />
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

  const unviewedByStage = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      if (r.unviewed) map.set(r.stage, (map.get(r.stage) ?? 0) + 1);
    }
    return map;
  }, [rows]);

  const showKanban = view === 'kanban' && !mobile;
  const promotePerson = promoteTarget ? people.get(promoteTarget.person_id) : null;

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
        <Button
          size="sm"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `${requisition.display_code}-applications.csv`,
              rows,
              EXPORT_COLUMNS,
            )
          }
        >
          Export CSV
        </Button>
        {!mobile && (
          <div className="pipeline-toggle" role="tablist" aria-label="Pipeline view">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'table'}
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >
              Table
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'kanban'}
              className={view === 'kanban' ? 'active' : ''}
              onClick={() => setView('kanban')}
            >
              Kanban
            </button>
          </div>
        )}
      </div>

      {error && <p className="rq-error">{error}</p>}

      {showKanban ? (
        <KanbanBoard
          stages={APPLICATION_STAGES.map((s) => ({
            key: s,
            label: s.replace(/_/g, ' '),
          }))}
          cards={kanbanCards}
          onMove={moveStage}
          columnExtras={(stageKey) => (
            <UnviewedBadge count={unviewedByStage.get(stageKey) ?? 0} />
          )}
        />
      ) : (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => void openCandidate(r)}
          emptyText="No applications yet."
        />
      )}

      {rejectTarget && (
        <Dialog
          title="Reject application"
          onClose={() => setRejectTarget(null)}
          footer={
            <>
              <Button onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!rejectReason.trim()}
                onClick={confirmReject}
              >
                Reject
              </Button>
            </>
          }
        >
          <p>
            A rejection reason is required before{' '}
            {people.get(rejectTarget.person_id)
              ? personName(people.get(rejectTarget.person_id)!)
              : 'this candidate'}{' '}
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
          footer={
            <>
              <Button onClick={() => setPromoteTarget(null)}>
                {promoteMsg ? 'Close' : 'Not now'}
              </Button>
              {!promoteMsg && (
                <Button variant="primary" onClick={() => void createContactProfile()}>
                  Create contact profile
                </Button>
              )}
            </>
          }
        >
          <p>
            {promotePerson ? personName(promotePerson) : 'This person'} was hired on{' '}
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
          existing={apps}
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
            const row = rows.find((r) => r.id === app.id);
            if (row) void openCandidate(row);
          }}
        />
      )}
    </div>
  );
}
