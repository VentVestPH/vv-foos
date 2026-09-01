import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBackToList } from '../../../lib/listReturn';
import { useRole, useSession } from '../../../auth/SessionProvider';
import type { RequisitionStatus, TablesUpdate } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { Timeline } from '../../../components/ui/Timeline';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { TaleoPlaceholderAction } from '../../../shell/TaleoPlaceholder';
import { BriefcaseIcon } from '../../../shell/icons';
import { Dialog } from '../components/Dialog';
import {
  ActivityPanel,
  AttachmentsPanel,
  RemindersPanel,
  TasksPanel,
  useEngagement,
} from '../components/engagement';
import {
  errMsg,
  fmtDate,
  fmtDateTime,
  REQ_ACTION_LABELS,
  REQ_TRANSITIONS,
  supabase,
  todayIso,
  useIsMobile,
  useLookups,
  type ApproverRow,
  type OwnerRow,
  type Requisition,
} from '../lib/data';
import { ApplicationPipeline } from './ApplicationPipeline';

export function RequisitionRecordPage() {
  const backToList = useBackToList('/recruit/requisitions');
  const { id } = useParams();
  const requisitionId = id ?? '';
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const { record } = useRecentlyViewed();

  const [req, setReq] = useState<Requisition | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pipelineCount, setPipelineCount] = useState(0);
  const [addSignal, setAddSignal] = useState(0);
  const pipelineRef = useRef<HTMLDivElement>(null);

  const engagement = useEngagement('requisition', requisitionId);

  const load = useCallback(async () => {
    try {
      const [r, o, a] = await Promise.all([
        supabase
          .from('requisitions')
          .select('*')
          .eq('id', requisitionId)
          .maybeSingle(),
        supabase
          .from('requisition_owners')
          .select('*')
          .eq('requisition_id', requisitionId),
        supabase
          .from('requisition_approvers')
          .select('*')
          .eq('requisition_id', requisitionId),
      ]);
      const firstError = r.error ?? o.error ?? a.error ?? null;
      if (firstError) throw new Error(firstError.message);
      setReq(r.data ?? null);
      setOwners(o.data ?? []);
      setApprovers(a.data ?? []);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [requisitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadPipelineCount = useCallback(async () => {
    if (!requisitionId) return;
    const { count, error: err } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('requisition_id', requisitionId);
    if (!err) setPipelineCount(count ?? 0);
  }, [requisitionId]);

  useEffect(() => {
    void loadPipelineCount();
  }, [loadPipelineCount]);

  useEffect(() => {
    if (!requisitionId) return;
    const channel = supabase
      .channel(`recruit-req-next-steps-${requisitionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `requisition_id=eq.${requisitionId}`,
        },
        () => void loadPipelineCount(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [requisitionId, loadPipelineCount]);

  useEffect(() => {
    if (req) {
      record({
        type: 'requisition',
        id: req.id,
        label: `${req.display_code} ${req.title}`,
        href: `/recruit/requisitions/${req.id}`,
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.id]);

  const staffName = useMemo(
    () => new Map(lookups.staff.map((s) => [s.id, s.full_name])),
    [lookups.staff],
  );
  const company = req?.company_id
    ? lookups.companies.find((c) => c.id === req.company_id)
    : undefined;

  const canEdit = (role === 'admin' || role === 'recruiter') && !mobile;

  const reqApprovers = approvers.filter((a) => a.approver_type === 'requisition');
  const allApproved =
    reqApprovers.length === 0 ||
    reqApprovers.every((a) => a.decision === 'approved');
  const myPendingApproval =
    req?.status === 'waiting_approval' && staff
      ? reqApprovers.find((a) => a.staff_id === staff.id && !a.decision)
      : undefined;

  const changeStatus = useCallback(
    async (next: RequisitionStatus) => {
      if (!req) return;
      if (!REQ_TRANSITIONS[req.status].includes(next)) {
        setError(`Illegal transition ${req.status} → ${next}.`);
        return;
      }
      if (next === 'open' && !allApproved) {
        setError('All requisition approvers must approve before opening.');
        return;
      }
      const payload: TablesUpdate<'requisitions'> = { status: next };
      if (next === 'open' && !req.opened_date) payload.opened_date = todayIso();
      if (next === 'filled') payload.filled_date = todayIso();
      const { error: err } = await supabase
        .from('requisitions')
        .update(payload)
        .eq('id', req.id);
      if (err) setError(err.message);
      else {
        setError(null);
        await load();
        await engagement.refresh();
      }
    },
    [req, allApproved, load, engagement],
  );

  const togglePublish = useCallback(async () => {
    if (!req) return;
    const { error: err } = await supabase
      .from('requisitions')
      .update({ is_published: !req.is_published })
      .eq('id', req.id);
    if (err) setError(err.message);
    else await load();
  }, [req, load]);

  const decide = useCallback(
    async (decision: 'approved' | 'rejected', reason?: string) => {
      if (!req || !staff) return;
      const text =
        decision === 'rejected' && reason ? `rejected: ${reason}` : decision;
      const { error: err } = await supabase
        .from('requisition_approvers')
        .update({ decision: text, decided_at: new Date().toISOString() })
        .eq('requisition_id', req.id)
        .eq('staff_id', staff.id)
        .eq('approver_type', 'requisition');
      if (err) {
        setError(err.message);
        return;
      }
      if (decision === 'rejected') {
        const { error: err2 } = await supabase
          .from('requisitions')
          .update({ status: 'draft' })
          .eq('id', req.id);
        if (err2) setError(err2.message);
      }
      await load();
      await engagement.refresh();
    },
    [req, staff, load, engagement],
  );

  if (!req) {
    return error ? (
      <p className="rq-error">{error}</p>
    ) : (
      <p className="text-secondary">Loading…</p>
    );
  }

  const lifecycleTargets = REQ_TRANSITIONS[req.status];

  const timelineItems = engagement.activities.map((a) => ({
    id: a.id,
    kind: a.kind,
    subject: a.subject,
    body: a.body,
    occurred_at: a.occurred_at,
    meta: a.created_by ? staffName.get(a.created_by) : undefined,
  }));

  const scrollToPipeline = () => {
    pipelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const lifecycleNextStep = (target: RequisitionStatus, label: string) => {
    if (canEdit && lifecycleTargets.includes(target)) {
      const gated = target === 'open' && !allApproved;
      return (
        <button
          type="button"
          className="link-btn"
          disabled={gated}
          onClick={() => void changeStatus(target)}
        >
          {label}
        </button>
      );
    }
    return <span className="taleo-next-step-disabled">{label}</span>;
  };

  const actionBarContent = canEdit ? (
    <>
      <Button size="sm" onClick={() => navigate(`/recruit/requisitions/${req.id}/edit`)}>
        Edit
      </Button>
      <TaleoPlaceholderAction label="Send To" size="sm" />
      <TaleoPlaceholderAction label="Forms" size="sm" />
      <TaleoPlaceholderAction label="Printable View" size="sm" />
      <TaleoPlaceholderAction label="More" size="sm" caret />
      {lifecycleTargets.map((target) => {
        const openGated = target === 'open' && !allApproved;
        return (
          <Button
            key={target}
            size="sm"
            variant={target === 'closed' ? 'danger' : 'primary'}
            disabled={openGated}
            title={openGated ? 'Waiting on requisition approver decisions' : undefined}
            onClick={() => void changeStatus(target)}
          >
            {REQ_ACTION_LABELS[target]}
          </Button>
        );
      })}
      <Button size="sm" onClick={() => void togglePublish()}>
        {req.is_published ? 'Unpublish' : 'Publish to careers page'}
      </Button>
    </>
  ) : (
    <span className="text-secondary">Read-only</span>
  );

  return (
    <RecordPage
      code={req.display_code}
      title={req.title}
      icon={<BriefcaseIcon size={40} />}
      titleExtras={
        <>
          <StatusBadge status={req.status} />
          {req.is_published && <Badge tone="primary">Published</Badge>}
          {req.is_test && <Badge tone="outline">Test data</Badge>}
          <button
            type="button"
            className="link-btn taleo-back-to-list"
            onClick={backToList}
          >
            Back To List
          </button>
        </>
      }
      actionBar={actionBarContent}
    >
      {error && <p className="rq-error">{error}</p>}

      <div className="taleo-next-steps">
        <span className="taleo-next-steps-label">Next Steps:</span>
        <button type="button" className="link-btn" onClick={scrollToPipeline}>
          Candidates ({pipelineCount})
        </button>
        <TaleoPlaceholderAction label="Search" variant="ghost" size="sm" />
        {canEdit ? (
          <button type="button" className="link-btn" onClick={() => setAddSignal((n) => n + 1)}>
            Add new candidate
          </button>
        ) : (
          <span className="taleo-next-step-disabled">Add new candidate</span>
        )}
        {lifecycleNextStep('filled', 'Filled')}
        {lifecycleNextStep('on_hold', 'Place on hold')}
        {lifecycleNextStep('closed', 'Close')}
      </div>

      <RecordSection title="Requisition Owner(s):">
        <div className="chip-row">
          {owners.length === 0 && <span className="text-secondary">No owners.</span>}
          {owners.map((o) => (
            <span key={o.staff_id} className="chip">
              {staffName.get(o.staff_id) ?? o.staff_id}
            </span>
          ))}
        </div>
      </RecordSection>

      <RecordSection title="Requisition Information:">
        <dl className="info-grid">
          {[
            ['Job code', req.job_code ?? ''],
            ['Location', req.location ?? ''],
            ['Employment type', req.employment_type ?? ''],
            ['Openings', String(req.num_openings)],
            ['Budget status', req.budget_status ?? ''],
            ['Reason for opening', req.reason_for_opening ?? ''],
            ['Replacement for', req.replacement_for ?? ''],
            [
              'Pay range',
              req.pay_min != null || req.pay_max != null
                ? `${req.pay_min ?? '—'} – ${req.pay_max ?? '—'} ${req.pay_currency ?? ''}`.trim()
                : '',
            ],
            ['Pay notes', req.pay_notes ?? ''],
            ['Opened', fmtDate(req.opened_date)],
            ['Filled', fmtDate(req.filled_date)],
          ]
            .filter(([, v]) => v !== '')
            .map(([label, value]) => (
              <div className="info-item" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </RecordSection>

      <RecordSection title="Description:">
        {req.description ? (
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{req.description}</p>
        ) : (
          <p className="text-secondary">No description provided.</p>
        )}
      </RecordSection>

      <RecordSection title="Attachments">
        <AttachmentsPanel
          items={engagement.attachments}
          parent={{ type: 'requisition', id: req.id }}
          allowUpload={!mobile}
          onChanged={engagement.refresh}
        />
      </RecordSection>

      <RecordSection title="Accounts / Company">
        {company ? (
          <dl className="info-grid">
            <div className="info-item">
              <dt>Account name</dt>
              <dd>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => navigate(`/sales/companies/${company.id}`)}
                >
                  {company.name}
                </button>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-secondary">No company linked.</p>
        )}
      </RecordSection>

      <RecordSection title="Contacts" defaultOpen={false}>
        {}
        <p className="text-secondary">No contacts attached.</p>
        <TaleoPlaceholderAction label="Attach Contact" size="sm" variant="ghost" />
        <TaleoPlaceholderAction label="New Contact" size="sm" variant="ghost" />
      </RecordSection>

      <RecordSection title="Tasks" defaultOpen={false}>
        <TasksPanel
          items={engagement.tasks}
          allowCreate={!mobile}
          onCreate={engagement.addTask}
          onToggle={engagement.toggleTask}
        />
      </RecordSection>

      <RecordSection title="Reminders" defaultOpen={false}>
        <RemindersPanel
          items={engagement.reminders}
          allowCreate={!mobile}
          onCreate={engagement.addReminder}
          onDismiss={engagement.dismissReminder}
        />
      </RecordSection>

      <RecordSection title="Comments" defaultOpen={false}>
        <ActivityPanel
          items={engagement.activities.filter((a) => a.kind === 'note')}
          kind="note"
          kindLabel="Comment"
          emptyText="No comments added"
          allowCreate={!mobile}
          onCreate={engagement.addActivity}
        />
      </RecordSection>

      <RecordSection title="History Log / Timeline" defaultOpen={false}>
        <Timeline items={timelineItems} />
        {engagement.error && <p className="rq-error">{engagement.error}</p>}
      </RecordSection>

      <RecordSection title="Tracking:">
        <dl className="info-grid">
          <div className="info-item">
            <dt>Last updated</dt>
            <dd>{fmtDateTime(req.updated_at)}</dd>
          </div>
          <div className="info-item">
            <dt>Added to system</dt>
            <dd>{fmtDateTime(req.created_at)}</dd>
          </div>
          <div className="info-item">
            <dt>ID</dt>
            <dd>{req.display_code}</dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection title="Approvals:">
        {approvers.length === 0 && (
          <p className="text-secondary">No approvers configured.</p>
        )}
        {approvers.map((a) => (
          <div key={`${a.staff_id}-${a.approver_type}`} className="approver-line">
            <span className="approver-name">
              {staffName.get(a.staff_id) ?? a.staff_id}
            </span>
            <Badge tone="outline">{a.approver_type}</Badge>
            {a.decision ? (
              <>
                <Badge tone={a.decision === 'approved' ? 'success' : 'danger'}>
                  {a.decision}
                </Badge>
                <span className="text-secondary">{fmtDateTime(a.decided_at)}</span>
              </>
            ) : (
              <Badge tone="warning">pending</Badge>
            )}
            {myPendingApproval &&
              a.staff_id === myPendingApproval.staff_id &&
              a.approver_type === 'requisition' &&
              !a.decision && (
                <span className="approver-actions">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void decide('approved')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setRejectReason('');
                      setRejecting(true);
                    }}
                  >
                    Reject
                  </Button>
                </span>
              )}
          </div>
        ))}
        {req.status === 'waiting_approval' && !allApproved && (
          <p className="text-secondary">
            Waiting on{' '}
            {reqApprovers.filter((a) => !a.decision).length} approver decision(s).
          </p>
        )}
      </RecordSection>

      <RecordSection title="Application Pipeline">
        <div ref={pipelineRef} id="application-pipeline">
          <ApplicationPipeline
            requisition={req}
            companies={lookups.companies}
            sources={lookups.sources}
            canEdit={canEdit}
            mobile={mobile}
            addSignal={addSignal}
          />
        </div>
      </RecordSection>

      <div className="record-action-bar taleo-record-bottom-bar">{actionBarContent}</div>

      {rejecting && (
        <Dialog
          title="Reject requisition"
          onClose={() => setRejecting(false)}
          footer={
            <>
              <Button onClick={() => setRejecting(false)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={!rejectReason.trim()}
                onClick={() => {
                  void decide('rejected', rejectReason.trim());
                  setRejecting(false);
                }}
              >
                Reject and return to draft
              </Button>
            </>
          }
        >
          <p>The requisition returns to draft with your decision visible.</p>
          <textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            aria-label="Rejection reason"
            placeholder="Reason (required)"
            autoFocus
          />
        </Dialog>
      )}
    </RecordPage>
  );
}
