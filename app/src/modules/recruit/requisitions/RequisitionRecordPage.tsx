import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRole, useSession } from '../../../auth/SessionProvider';
import type { RequisitionStatus, TablesUpdate } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { ActionMenu, type ActionMenuItem } from '../../../components/ui/ActionMenu';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { useSectionCollapse } from '../../../components/ui/SectionCollapse';
import { EmptyState } from '../../../components/ui/EmptyState';
import { looksLikeHtml, sanitizeHtml } from '../../../lib/sanitizeHtml';
import { StatusHistory } from '../../../components/ui/StatusHistory';
import { Timeline } from '../../../components/ui/Timeline';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import {
  Briefcase as BriefcaseIcon,
  Building2 as Building2Icon,
  Contact as ContactIcon,
  FileText as FileTextIcon,
  UserCheck as UserCheckIcon,
  UserRound as UserRoundIcon,
} from 'lucide-react';
import { Dialog } from '../components/Dialog';
import {
  ActivityPanel,
  AttachmentsPanel,
  RemindersPanel,
  TasksPanel,
  useEngagement,
} from '../components/engagement';
import { realtimeChannel } from '../../../lib/realtimeChannel';
import { useListReturnHref } from '../../../lib/listReturn';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { printExpanded } from '../../../lib/printRecord';
import { RecordSkeleton } from '../../../components/ui/RecordSkeleton';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { SectionSettingsDialog } from '../../../components/ui/SectionSettingsDialog';
import { useSectionPrefs } from '../../../hooks/useSectionPrefs';
import { supabase } from '../../../lib/supabase';
import { type ApproverRow, type OwnerRow, REQ_ACTION_LABELS, REQ_PRIMARY_ACTION, REQ_TRANSITIONS, type Requisition, errMsg, fmtDate, fmtDateTime, todayIso } from '../lib';
import { useIsMobile, useLookups } from '../hooks';
import { ApplicationPipeline } from './ApplicationPipeline';
import { EMPTY_CELL, sentenceCase } from '../../../lib/format';

const REQ_SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  'Requisition Owner(s):': true,
  'Requisition Information:': true,
  'Description:': true,
  Attachments: false,
  'Accounts / Company': false,
  'Company contacts': false,
  Tasks: false,
  Reminders: false,
  Comments: false,
  'Status History': false,
  'History Log / Timeline': false,
  'Tracking:': false,
  'Approvals:': false,
  'Application Pipeline': true,
};

const REQ_RECORD_SECTIONS = Object.keys(REQ_SECTION_DEFAULT_OPEN);

export function RequisitionRecordPage() {
  const { id } = useParams();
  const requisitionId = id ?? '';
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const { record } = useRecentlyViewed();
  const listHref = useListReturnHref('/recruit/requisitions');
  const collapse = useSectionCollapse();

  const [req, setReq] = useState<Requisition | null>(null);
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const showSkeleton = useMinimumVisible(!loaded);
  const [companyContacts, setCompanyContacts] = useState<
    { person_id: string; full_name: string; title: string | null; isPrimary: boolean }[]
  >([]);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [pipelineCount, setPipelineCount] = useState(0);
  const [addSignal, setAddSignal] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const prefs = useSectionPrefs('recruit.requisition.record');
  const opensOnLoad = (section: string) =>
    prefs.opensOnLoad(section, REQ_SECTION_DEFAULT_OPEN[section] ?? true);
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
    } finally {
      setLoaded(true);
    }
  }, [requisitionId]);

  useEffect(() => {
    const companyId = req?.company_id;
    if (!companyId) {
      setCompanyContacts([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from('contact_list')
      .select('person_id, full_name, title, is_primary')
      .eq('company_id', companyId)
      .order('full_name')
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return;
        setCompanyContacts(
          (data ?? []).map((r) => ({
            person_id: r.person_id as string,
            full_name: (r.full_name as string) ?? 'Unnamed',
            title: (r.title as string | null) ?? null,
            isPrimary: r.is_primary === true,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [req?.company_id]);

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
    const channel = realtimeChannel(`recruit-req-next-steps-${requisitionId}`)
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

  if (showSkeleton) {
    return <RecordSkeleton label="Loading requisition" sections={REQ_RECORD_SECTIONS.length} />;
  }

  if (!req) {
    if (error) {
      return <p className="form-error" role="alert">{error}</p>;
    }
    return (
      <div className="stub-panel">
        <h1>Requisition not found</h1>
        <p>This record does not exist, or your role does not have access to it.</p>
      </div>
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

  const printAll = () => {
    printExpanded(() => collapse?.setAll(true));
  };

  const primaryTarget = REQ_PRIMARY_ACTION[req.status];
  const primaryGated = primaryTarget === 'open' && !allApproved;
  const overflowItems: ActionMenuItem[] = [
    ...lifecycleTargets
      .filter((target) => target !== primaryTarget)
      .map((target) => {
        const gated = target === 'open' && !allApproved;
        const item: ActionMenuItem = {
          label: REQ_ACTION_LABELS[target],
          destructive: target === 'closed',
          disabled: gated,
          onSelect: () => void changeStatus(target),
        };
        if (gated) item.title = 'Waiting on requisition approver decisions';
        return item;
      }),
    {
      label: req.is_published ? 'Unpublish' : 'Publish to careers page',
      onSelect: () => void togglePublish(),
    },
  ];

  const actionBarContent = canEdit ? (
    <>
      {primaryTarget !== undefined && lifecycleTargets.includes(primaryTarget) && (
        <Button
          size="sm"
          variant="primary"
          disabled={primaryGated}
          title={primaryGated ? 'Waiting on requisition approver decisions' : undefined}
          onClick={() => void changeStatus(primaryTarget)}
        >
          {REQ_ACTION_LABELS[primaryTarget]}
        </Button>
      )}
      <Button size="sm" onClick={() => navigate(`/recruit/requisitions/${req.id}/edit`)}>
        Edit
      </Button>
      <Button size="sm" variant="ghost" onClick={printAll}>
        Printable View
      </Button>
      <ActionMenu label="More actions" items={overflowItems} iconOnly />
    </>
  ) : (
    <span className="text-secondary">Read-only</span>
  );

  return (
    <RecordPage
      code={req.display_code}
      title={req.title}
      icon={<BriefcaseIcon size={32} />}
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Requisitions', to: listHref },
        { label: req.display_code },
      ]}
      headerActions={
        <SettingsButton
          label="Section settings"
          title="Choose which sections appear"
          onClick={() => setSettingsOpen(true)}
        />
      }
      titleExtras={
        <>
          <StatusBadge status={req.status} />
          {req.is_published && <Badge tone="primary">Published</Badge>}
          {req.is_test && <Badge tone="outline">Test record</Badge>}
        </>
      }
      actionBar={actionBarContent}
    >
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="fo-next-steps">
        <span className="fo-next-steps-label">Next Steps:</span>
        <button type="button" className="link-btn" onClick={scrollToPipeline}>
          Candidates ({pipelineCount})
        </button>
        {canEdit ? (
          <button type="button" className="link-btn" onClick={() => setAddSignal((n) => n + 1)}>
            Add new candidate
          </button>
        ) : (
          <span className="fo-next-step-disabled">Add new candidate</span>
        )}
      </div>

      <RecordSection title="Requisition Owner(s):" hidden={prefs.isHidden('Requisition Owner(s):')} defaultOpen={opensOnLoad('Requisition Owner(s):')}>
        {owners.length === 0 ? (
          <EmptyState
            compact
            icon={<UserRoundIcon size={32} />}
            title="No owner assigned"
            hint="Use Edit to give this requisition an owner."
          />
        ) : (
          <div className="chip-row">
            {owners.map((o) => (
              <span key={o.staff_id} className="chip">
                {staffName.get(o.staff_id) ?? o.staff_id}
              </span>
            ))}
          </div>
        )}
      </RecordSection>

      <RecordSection title="Requisition Information:" hidden={prefs.isHidden('Requisition Information:')} defaultOpen={opensOnLoad('Requisition Information:')}>
        <dl className="info-grid">
          {[
            ['Opened Date', fmtDate(req.opened_date)],
            ['Budget Status', sentenceCase(req.budget_status ?? '')],
            ['Job Code', req.job_code ?? ''],
            ['Reason for Opening', req.reason_for_opening ?? ''],
            ['Title', req.title ?? ''],
            ['Replacement for', req.replacement_for ?? ''],
            ['Location', req.location ?? ''],
            ['Employment duration', sentenceCase(req.employment_type ?? '')],
            ['Status', sentenceCase(req.status ?? '')],
            [
              'Pay range',
              req.pay_min != null || req.pay_max != null
                ? `${req.pay_min ?? EMPTY_CELL} – ${req.pay_max ?? EMPTY_CELL} ${req.pay_currency ?? ''}`.trim()
                : '',
            ],
            ['# of openings', String(req.num_openings)],
            ['Pay notes', req.pay_notes ?? ''],
            ['Filled date', fmtDate(req.filled_date)],
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

      <RecordSection title="Description:" hidden={prefs.isHidden('Description:')} defaultOpen={opensOnLoad('Description:')}>
        {req.description ? (
          looksLikeHtml(req.description) ? (
            <div
              className="fo-rich-text"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(req.description) }}
            />
          ) : (
            <p className="fo-plain-text">{req.description}</p>
          )
        ) : (
          <EmptyState
            compact
            icon={<FileTextIcon size={32} />}
            title="No description provided"
            hint="Use Edit to write the copy that appears on the careers page."
          />
        )}
      </RecordSection>

      <RecordSection title="Attachments" hidden={prefs.isHidden('Attachments')} defaultOpen={opensOnLoad('Attachments')}>
        <AttachmentsPanel
          items={engagement.attachments}
          parent={{ type: 'requisition', id: req.id }}
          allowUpload={!mobile}
          onChanged={engagement.refresh}
        />
      </RecordSection>

      <RecordSection title="Accounts / Company" hidden={prefs.isHidden('Accounts / Company')} defaultOpen={opensOnLoad('Accounts / Company')}>
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
          <EmptyState
            compact
            icon={<Building2Icon size={32} />}
            title="No company linked"
            hint="Use Edit to attach this requisition to an account."
          />
        )}
      </RecordSection>

      <RecordSection
        title={req.company_id ? `Company contacts (${companyContacts.length})` : 'Company contacts'}
        hidden={prefs.isHidden('Company contacts')}
        defaultOpen={opensOnLoad('Company contacts')}
      >
        {!req.company_id ? (
          <EmptyState
            compact
            icon={<ContactIcon size={32} />}
            title="No company linked"
            hint="Attach an account to this requisition and its contacts will appear here."
          />
        ) : companyContacts.length === 0 ? (
          <EmptyState
            compact
            icon={<ContactIcon size={32} />}
            title="This company has no contacts on file"
            hint="Add one from the account record."
          />
        ) : (
          <ul className="task-list">
            {companyContacts.map((c) => (
              <li key={c.person_id} className="task-row" data-kind="note">
                <span className="task-due">{c.isPrimary ? 'Primary contact' : 'Contact'}</span>
                <span className="task-subject">
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate(`/sales/contacts/${c.person_id}`)}
                  >
                    {c.full_name}
                  </button>
                </span>
                <span className="task-related">{c.title ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </RecordSection>

      <RecordSection title="Tasks" hidden={prefs.isHidden('Tasks')} defaultOpen={opensOnLoad('Tasks')}>
        <TasksPanel
          items={engagement.tasks}
          allowCreate={!mobile}
          onCreate={engagement.addTask}
          onToggle={engagement.toggleTask}
        />
      </RecordSection>

      <RecordSection title="Reminders" hidden={prefs.isHidden('Reminders')} defaultOpen={opensOnLoad('Reminders')}>
        <RemindersPanel
          items={engagement.reminders}
          allowCreate={!mobile}
          onCreate={engagement.addReminder}
          onDismiss={engagement.dismissReminder}
        />
      </RecordSection>

      <RecordSection title="Comments" hidden={prefs.isHidden('Comments')} defaultOpen={opensOnLoad('Comments')}>
        <ActivityPanel
          items={engagement.activities.filter((a) => a.kind === 'note')}
          kind="note"
          kindLabel="Comment"
          emptyText="No comments added"
          allowCreate={!mobile}
          onCreate={engagement.addActivity}
        />
      </RecordSection>

      <RecordSection title="Status History" hidden={prefs.isHidden('Status History')} defaultOpen={opensOnLoad('Status History')}>
        <StatusHistory changes={engagement.activities.filter((a) => a.kind === 'status_change')} />
      </RecordSection>

      <RecordSection title="History Log / Timeline" hidden={prefs.isHidden('History Log / Timeline')} defaultOpen={opensOnLoad('History Log / Timeline')}>
        <Timeline items={timelineItems} />
        {engagement.error && <p className="form-error" role="alert">{engagement.error}</p>}
      </RecordSection>

      <RecordSection title="Tracking:" hidden={prefs.isHidden('Tracking:')} defaultOpen={opensOnLoad('Tracking:')}>
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

      <RecordSection title="Approvals:" hidden={prefs.isHidden('Approvals:')} defaultOpen={opensOnLoad('Approvals:')}>
        {approvers.length === 0 && (
          <EmptyState
            compact
            icon={<UserCheckIcon size={32} />}
            title="No approvers configured"
            hint="Use Edit to add the people who sign this requisition off."
          />
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

      <RecordSection title="Application Pipeline" hidden={prefs.isHidden('Application Pipeline')} defaultOpen={opensOnLoad('Application Pipeline')}>
        <div ref={pipelineRef} id="application-pipeline">
          <ApplicationPipeline
            requisition={req}
            companies={lookups.companies}
            canEdit={canEdit}
            mobile={mobile}
            addSignal={addSignal}
          />
        </div>
      </RecordSection>


      {rejecting && (
        <Dialog
          title="Reject requisition"
          onClose={() => setRejecting(false)}
          footer={(dismiss) => (
            <>
              <Button onClick={dismiss}>Cancel</Button>
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
          )}
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
      {settingsOpen && (
        <SectionSettingsDialog
          title="Section settings"
          hint="Choose which sections appear on this requisition. The choice is saved to your account."
          sections={REQ_RECORD_SECTIONS}
          prefs={prefs}
          defaultOpenFor={(section) => REQ_SECTION_DEFAULT_OPEN[section] ?? true}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </RecordPage>
  );
}
