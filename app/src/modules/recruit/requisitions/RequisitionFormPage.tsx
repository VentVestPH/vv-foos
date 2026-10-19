import { useEffect, useMemo, useState } from 'react';
import { AccessDenied } from '../../../components/ui/AccessDenied';
import { useNavigate, useParams } from 'react-router-dom';
import { useRole } from '../../../auth/SessionProvider';
import type { ApproverType, TablesInsert } from '../../../lib/database.types';
import { Button } from '../../../components/ui/Button';
import { useListReturnHref } from '../../../lib/listReturn';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { RecordSection } from '../../../components/ui/RecordPage';
import { Breadcrumbs } from '../../../components/ui/Breadcrumbs';
import { FoDialog } from '../../../components/ui/FoDialog';
import { FormSections, type FormSection } from '../../../components/ui/FormSections';
import { RecordSkeleton } from '../../../components/ui/RecordSkeleton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { looksLikeHtml, sanitizeHtml } from '../../../lib/sanitizeHtml';
import { CollapseAllButton } from '../../../components/ui/SectionCollapse';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Briefcase as BriefcaseIcon, Eye as EyeIcon, PencilLine as PencilIcon } from 'lucide-react';
import { CURRENCIES } from '../../../lib/format';
import { ErrorSummary, type FieldError } from '../../../components/ui/ErrorSummary';
import { supabase } from '../../../lib/supabase';
import { type ApproverRow, errMsg, todayIso } from '../lib';
import { useLookups } from '../hooks';
import { useScrollShadow } from '../../../hooks/useScrollShadow';

interface FormState {
  title: string;
  job_code: string;
  description: string;
  company_id: string;
  location: string;
  employment_type: string;
  num_openings: string;
  budget_status: string;
  reason_for_opening: string;
  replacement_for: string;
  pay_min: string;
  pay_max: string;
  pay_currency: string;
  pay_notes: string;
  opened_date: string;
  is_published: boolean;
  is_test: boolean;
}

const EMPTY: FormState = {
  title: '',
  job_code: '',
  description: '',
  company_id: '',
  location: '',
  employment_type: '',
  num_openings: '1',
  budget_status: '',
  reason_for_opening: '',
  replacement_for: '',
  pay_min: '',
  pay_max: '',
  pay_currency: '',
  pay_notes: '',
  opened_date: todayIso(),
  is_published: false,
  is_test: false,
};

interface ApproverDraft {
  staff_id: string;
  approver_type: ApproverType;
}

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'];
const BUDGET_STATUSES = ['Approved', 'Pending', 'Not budgeted'];
const REASONS = ['New position', 'Replacement', 'Expansion', 'Other'];

const REQ_FORM_SECTIONS = [
  'Requisition Owner(s):',
  'Requisition Information:',
  'Description:',
  'Approvers:',
];

interface RequisitionFormPageProps {
  dialogId?: string;
  onClose?: () => void;
  onSaved?: () => void;
}

export function RequisitionFormPage({ dialogId, onClose, onSaved }: RequisitionFormPageProps = {}) {
  const listShadow = useScrollShadow<HTMLDivElement>();
  const { id } = useParams();
  const recordId = dialogId ?? id;
  const inDialog = dialogId !== undefined;
  const listHref = useListReturnHref('/recruit/requisitions');
  const editing = Boolean(recordId);
  const navigate = useNavigate();
  const role = useRole();
  const lookups = useLookups();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [approvers, setApprovers] = useState<ApproverDraft[]>([]);
  const [originalApprovers, setOriginalApprovers] = useState<ApproverRow[]>([]);
  const [originalOwners, setOriginalOwners] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [descriptionView, setDescriptionView] = useState<'write' | 'preview'>('write');
  const [loaded, setLoaded] = useState(!editing);
  const held = useMinimumVisible(!loaded);
  const showSkeleton = dialogId === undefined ? held : !loaded;

  const [initialForm, setInitialForm] = useState<FormState>(EMPTY);
  const [initialOwnerIds, setInitialOwnerIds] = useState<string[]>([]);
  const [initialApprovers, setInitialApprovers] = useState<ApproverDraft[]>([]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!editing || !recordId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [r, o, a] = await Promise.all([
          supabase.from('requisitions').select('*').eq('id', recordId).maybeSingle(),
          supabase.from('requisition_owners').select('*').eq('requisition_id', recordId),
          supabase.from('requisition_approvers').select('*').eq('requisition_id', recordId),
        ]);
        const firstError = r.error ?? o.error ?? a.error ?? null;
        if (firstError) throw new Error(firstError.message);
        if (cancelled || !r.data) return;
        const req = r.data;
        const loadedForm: FormState = {
          title: req.title,
          job_code: req.job_code ?? '',
          description: req.description ?? '',
          company_id: req.company_id ?? '',
          location: req.location ?? '',
          employment_type: req.employment_type ?? '',
          num_openings: String(req.num_openings),
          budget_status: req.budget_status ?? '',
          reason_for_opening: req.reason_for_opening ?? '',
          replacement_for: req.replacement_for ?? '',
          pay_min: req.pay_min == null ? '' : String(req.pay_min),
          pay_max: req.pay_max == null ? '' : String(req.pay_max),
          pay_currency: req.pay_currency ?? '',
          pay_notes: req.pay_notes ?? '',
          opened_date: req.opened_date ?? '',
          is_published: req.is_published,
          is_test: req.is_test,
        };
        setForm(loadedForm);
        setInitialForm(loadedForm);
        const ownerList = (o.data ?? []).map((row) => row.staff_id);
        setOwnerIds(ownerList);
        setOriginalOwners(ownerList);
        setInitialOwnerIds(ownerList);
        setOriginalApprovers(a.data ?? []);
        const approverDrafts = (a.data ?? []).map((row) => ({
          staff_id: row.staff_id,
          approver_type: row.approver_type,
        }));
        setApprovers(approverDrafts);
        setInitialApprovers(approverDrafts);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, recordId]);

  const validation = useMemo(() => {
    const problems: FieldError[] = [];
    if (!form.title.trim()) problems.push({ field: 'req-title', message: 'Title is required.' });
    if (ownerIds.length === 0) problems.push({ message: 'At least one owner is required.' });
    const min = form.pay_min ? Number(form.pay_min) : null;
    const max = form.pay_max ? Number(form.pay_max) : null;
    if (min != null && Number.isNaN(min)) {
      problems.push({ field: 'req-pay-min', message: 'Pay min must be a number.' });
    }
    if (max != null && Number.isNaN(max)) {
      problems.push({ field: 'req-pay-max', message: 'Pay max must be a number.' });
    }
    if (min != null && max != null && !Number.isNaN(min) && !Number.isNaN(max) && min > max) {
      problems.push({ field: 'req-pay-min', message: 'Pay min cannot exceed pay max.' });
    }
    if (approvers.some((a) => !a.staff_id)) {
      problems.push({ message: 'Every approver row needs a staff member.' });
    }
    return problems;
  }, [form, ownerIds, approvers]);

  const resetForm = () => {
    setForm(initialForm);
    setOwnerIds(initialOwnerIds);
    setApprovers(initialApprovers.map((a) => ({ ...a })));
    setError(null);
  };

  const save = async () => {
    if (validation.length > 0) {
      setShowProblems(true);
      return;
    }
    setShowProblems(false);
    setBusy(true);
    setError(null);
    try {
      const payload: TablesInsert<'requisitions'> = {
        title: form.title.trim(),
        job_code: form.job_code.trim() || null,
        description: form.description || null,
        company_id: form.company_id || null,
        location: form.location.trim() || null,
        employment_type: form.employment_type || null,
        num_openings: Math.max(1, parseInt(form.num_openings, 10) || 1),
        budget_status: form.budget_status || null,
        reason_for_opening: form.reason_for_opening || null,
        replacement_for: form.replacement_for.trim() || null,
        pay_min: form.pay_min ? Number(form.pay_min) : null,
        pay_max: form.pay_max ? Number(form.pay_max) : null,
        pay_currency: form.pay_currency || null,
        pay_notes: form.pay_notes.trim() || null,
        opened_date: form.opened_date || null,
        is_published: form.is_published,
        is_test: form.is_test,
      };

      let reqId = recordId ?? '';
      if (editing && recordId) {
        const { error: err } = await supabase
          .from('requisitions')
          .update(payload)
          .eq('id', recordId);
        if (err) throw new Error(err.message);
      } else {
        const { data, error: err } = await supabase
          .from('requisitions')
          .insert({ ...payload, status: 'draft' })
          .select('*')
          .single();
        if (err) throw new Error(err.message);
        reqId = data.id;
      }

      const removedOwners = originalOwners.filter((s) => !ownerIds.includes(s));
      const addedOwners = ownerIds.filter((s) => !originalOwners.includes(s));
      if (removedOwners.length > 0) {
        const { error: err } = await supabase
          .from('requisition_owners')
          .delete()
          .eq('requisition_id', reqId)
          .in('staff_id', removedOwners);
        if (err) throw new Error(err.message);
      }
      if (addedOwners.length > 0) {
        const { error: err } = await supabase
          .from('requisition_owners')
          .insert(addedOwners.map((staff_id) => ({ requisition_id: reqId, staff_id })));
        if (err) throw new Error(err.message);
      }

      const keyOf = (a: { staff_id: string; approver_type: ApproverType }) =>
        `${a.staff_id}|${a.approver_type}`;
      const currentKeys = new Set(approvers.map(keyOf));
      const originalKeys = new Set(originalApprovers.map(keyOf));
      const removedApprovers = originalApprovers.filter((a) => !currentKeys.has(keyOf(a)));
      if (removedApprovers.length > 0) {
        const { error: err } = await supabase
          .from('requisition_approvers')
          .delete()
          .eq('requisition_id', reqId)
          .or(
            removedApprovers
              .map((a) => `and(staff_id.eq.${a.staff_id},approver_type.eq.${a.approver_type})`)
              .join(','),
          );
        if (err) throw new Error(err.message);
      }
      const added = approvers.filter((a) => !originalKeys.has(keyOf(a)));
      if (added.length > 0) {
        const { error: err } = await supabase.from('requisition_approvers').insert(
          added.map((a) => ({
            requisition_id: reqId,
            staff_id: a.staff_id,
            approver_type: a.approver_type,
          })),
        );
        if (err) throw new Error(err.message);
      }

      if (onSaved) onSaved();

      else navigate(`/recruit/requisitions/${reqId}`);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  if (role !== 'admin' && role !== 'recruiter') {
    return (
      <AccessDenied
        what="edit requisitions"
        backTo="/recruit/requisitions"
        backLabel="Back To List"
      />
    );
  }
  if (showSkeleton && !inDialog) {
    return (
      <RecordSkeleton label="Loading requisition" sections={REQ_FORM_SECTIONS.length} panel />
    );
  }

  const actionButtons = (
    <div className="fo-page-toolbar">
      <div className="record-action-bar rq-form-actions">
        <Button
          variant="primary"
          onClick={() => void save()}
          disabled={busy}
          title={busy ? 'Saving' : undefined}
        >
          Save
        </Button>
        <Button onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={resetForm}>Reset</Button>
      </div>
    </div>
  );

  const problemBanner = (
    <>
      <ErrorSummary errors={showProblems ? validation : []} />
      {error !== null && <p className="form-error" role="alert">{error}</p>}
    </>
  );

  const sectionParts: FormSection[] = [
    {
      name: 'Requisition owners',
      content: (
        <>
        <div className="field">
          <span className="field-label">
            <span className="field-required">*</span> Requisition Owners
          </span>
          <div className="checkbox-list fo-scroll-shade" ref={listShadow}>
            {lookups.staff.map((s) => (
              <label key={s.id} className="checkline">
                <input
                  type="checkbox"
                  checked={ownerIds.includes(s.id)}
                  onChange={(e) =>
                    setOwnerIds(
                      e.target.checked
                        ? [...ownerIds, s.id]
                        : ownerIds.filter((x) => x !== s.id),
                    )
                  }
                />
                {s.full_name}
              </label>
            ))}
          </div>
        </div>
      
        </>
      ),
    },
    {
      name: 'Requisition information',
      content: (
        <>
          <section className="rq-form-group">
            <h3 className="rq-form-group-title">Role</h3>
            <div className="rq-form-grid">
            <div className="fo-form-span">
              <Input
                id="req-title"
                label="Title"
                required
                error={showProblems ? validation.find((v) => v.field === 'req-title')?.message : undefined}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </div>
            <Input
              label="Job code"
              value={form.job_code}
              onChange={(e) => set('job_code', e.target.value)}
              placeholder="<Client>-<n>, e.g. Acme-3"
            />
            <Select
              label="Company"
              placeholder="Select company…"
              options={lookups.companies.map((c) => ({ value: c.id, label: c.name }))}
              value={form.company_id}
              onChange={(e) => set('company_id', e.target.value)}
              help={
                <>
                  Company not listed?{' '}
                  {role === 'admin' ? (
                    <a href="/sales/companies/new" target="_blank" rel="noopener noreferrer">
                      Create the account in a new tab, then reload this page
                    </a>
                  ) : (
                    'Ask an admin or BD to add the account, then reload this page.'
                  )}
                </>
              }
            />
            <Input
              label="Location"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
            />
            </div>
          </section>
          <section className="rq-form-group">
            <h3 className="rq-form-group-title">Opening</h3>
            <div className="rq-form-grid">
            <Select
              label="Employment type"
              placeholder="Select…"
              options={EMPLOYMENT_TYPES.map((v) => ({ value: v, label: v }))}
              value={form.employment_type}
              onChange={(e) => set('employment_type', e.target.value)}
            />
            <Input
              label="Openings"
              type="number"
              min={1}
              required
              value={form.num_openings}
              onChange={(e) => set('num_openings', e.target.value)}
            />
            <DateField
              label="Opened date"
              value={form.opened_date}
              onChange={(e) => set('opened_date', e.target.value)}
            />
            <Select
              label="Budget status"
              placeholder="Select…"
              options={BUDGET_STATUSES.map((v) => ({ value: v, label: v }))}
              value={form.budget_status}
              onChange={(e) => set('budget_status', e.target.value)}
            />
            <Select
              label="Reason for opening"
              placeholder="Select…"
              options={REASONS.map((v) => ({ value: v, label: v }))}
              value={form.reason_for_opening}
              onChange={(e) => set('reason_for_opening', e.target.value)}
            />
            {form.reason_for_opening === 'Replacement' && (
              <Input
                label="Replacement for"
                value={form.replacement_for}
                onChange={(e) => set('replacement_for', e.target.value)}
              />
            )}
            </div>
          </section>
          <section className="rq-form-group">
            <h3 className="rq-form-group-title">Compensation</h3>
            <div className="rq-form-grid">
            <Input
              id="req-pay-min"
              label="Pay min"
              type="number"
              error={showProblems ? validation.find((v) => v.field === 'req-pay-min')?.message : undefined}
              value={form.pay_min}
              onChange={(e) => set('pay_min', e.target.value)}
            />
            <Input
              id="req-pay-max"
              label="Pay max"
              type="number"
              error={showProblems ? validation.find((v) => v.field === 'req-pay-max')?.message : undefined}
              value={form.pay_max}
              onChange={(e) => set('pay_max', e.target.value)}
            />
            <Select
              label="Pay currency"
              placeholder="Currency…"
              options={CURRENCIES.map((v) => ({ value: v, label: v }))}
              value={form.pay_currency}
              onChange={(e) => set('pay_currency', e.target.value)}
            />
              <div className="field fo-form-span">
                <label className="field-label" htmlFor="req-pay-notes">
                  Pay notes
                </label>
                <textarea
                  id="req-pay-notes"
                  rows={3}
                  value={form.pay_notes}
                  onChange={(e) => set('pay_notes', e.target.value)}
                  placeholder="e.g. plus commission, relocation, bonus terms"
                />
              </div>
            </div>
          </section>
          <section className="rq-form-group">
            <h3 className="rq-form-group-title">Visibility</h3>
            <div className="fo-checkstack">
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(e) => set('is_published', e.target.checked)}
                />
                Publish to careers page
              </label>
              <label className="checkline">
                <input
                  type="checkbox"
                  checked={form.is_test}
                  onChange={(e) => set('is_test', e.target.checked)}
                />
                Test record
              </label>
            </div>
          </section>
        </>
      ),
    },
    {
      name: 'Description',
      content: (
        <>
        <div className="field">
          <label className="field-label" htmlFor="req-description">
            Description
          </label>
          <div className="rq-editor-toolbar">
            <div
              className="rq-editor-tools"
              role="toolbar"
              aria-label="Text formatting (not available)"
            >
              {['Undo', 'Redo', 'Bold', 'Italic', 'Underline', 'Bullet list', 'Numbered list', 'Link'].map(
                (label) => (
                  <PlaceholderAction
                    key={label}
                    label={label}
                    size="sm"
                    variant="ghost"
                    className="rq-editor-toolbar-btn"
                  />
                ),
              )}
            </div>
            <SegmentedToggle
              className="rq-editor-view"
              ariaLabel="Description view"
              value={descriptionView}
              onChange={setDescriptionView}
              options={[
                {
                  value: 'write',
                  label: '',
                  title: 'Write',
                  icon: <PencilIcon size={20} aria-hidden="true" />,
                },
                {
                  value: 'preview',
                  label: '',
                  title: 'Preview',
                  icon: <EyeIcon size={20} aria-hidden="true" />,
                },
              ]}
            />
          </div>
          {descriptionView === 'preview' ? (
            <div className="rq-description-preview">
              {form.description.trim() ? (
                looksLikeHtml(form.description) ? (
                  <div
                    className="fo-rich-text"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(form.description) }}
                  />
                ) : (
                  <p className="fo-plain-text">{form.description}</p>
                )
              ) : (
                <p className="text-secondary">Nothing to preview yet.</p>
              )}
            </div>
          ) : (
            <textarea
              id="req-description"
              className="rq-description-input"
              rows={8}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Role description shown on the careers page when published."
            />
          )}
        </div>
      
        </>
      ),
    },
    {
      name: 'Approvers',
      content: (
        <>
        {approvers.map((a, i) => (
          <div key={`${a.staff_id}-${a.approver_type}-${i}`} className="rq-approver-row">
            <Select
              label="Approver"
              placeholder="Select staff…"
              options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
              value={a.staff_id}
              onChange={(e) =>
                setApprovers(
                  approvers.map((x, j) =>
                    j === i ? { ...x, staff_id: e.target.value } : x,
                  ),
                )
              }
            />
            <Select
              label="Type"
              options={[
                { value: 'requisition', label: 'requisition' },
                { value: 'offer', label: 'offer' },
              ]}
              value={a.approver_type}
              onChange={(e) =>
                setApprovers(
                  approvers.map((x, j) =>
                    j === i
                      ? { ...x, approver_type: e.target.value as ApproverType }
                      : x,
                  ),
                )
              }
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setApprovers(approvers.filter((_, j) => j !== i))}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            size="sm"
            onClick={() =>
              setApprovers([...approvers, { staff_id: '', approver_type: 'requisition' }])
            }
          >
            Add approver
          </Button>
        </div>
      
        </>
      ),
    },
  ];



  if (inDialog) {
    return (
      <FoDialog
        className="fo-form-dialog fo-dialog-panel-form"
        title={`Edit: ${form.title.trim() || 'Requisition'}`}
        onClose={onClose ?? (() => undefined)}
        footer={(close) => (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving\u2026' : 'Save'}
            </Button>
          </>
        )}
      >
        {showSkeleton ? (
          <Skeleton rows={8} label="Loading requisition" />
        ) : (
          <>
            {problemBanner}
            <FormSections sections={sectionParts} />
          </>
        )}
      </FoDialog>
    );
  }

  return (
    <div className="record-page">
      <div className="fo-page-head">
        <div className="record-breadcrumb">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Requisitions', to: listHref },
              ...(editing
                ? [
                    {
                      label: form.title.trim() || 'Requisition',
                      to: `/recruit/requisitions/${recordId ?? ''}`,
                    },
                    { label: 'Edit' },
                  ]
                : [{ label: 'New requisition' }]),
            ]}
          />
        </div>
        <div className="record-title-row">
          <span className="fo-page-icon">
            <BriefcaseIcon size={32} />
          </span>
          <h1>
            {editing ? `Edit: ${form.title.trim() || 'Requisition'}` : 'Requisitions: New Requisition'}
          </h1>
          <div className="fo-page-header-actions">
            <CollapseAllButton />
          </div>
        </div>
      </div>
      {actionButtons}
      <form
        className="rq-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {problemBanner}
        {sectionParts.map((part) => (
          <RecordSection key={part.name} title={part.name}>
            {part.content}
          </RecordSection>
        ))}
      </form>
    </div>
  );
}
