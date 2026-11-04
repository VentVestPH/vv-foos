import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, UserPlus } from 'lucide-react';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { DateField } from '../../../components/ui/DateField';
import { ErrorSummary, type FieldError } from '../../../components/ui/ErrorSummary';
import { Input } from '../../../components/ui/Input';
import { RecordPage } from '../../../components/ui/RecordPage';
import { Select } from '../../../components/ui/Select';
import { StarGrade } from '../../../components/ui/StarGrade';
import { StatusBadge } from '../../../components/ui/Badge';
import { CURRENCIES } from '../../../lib/format';
import { errMsg } from '../../../lib/errMsg';
import { EMAIL_PATTERN, PHONE_PATTERN, PHONE_RULE } from '../../../lib/personValidation';
import { supabase } from '../../../lib/supabase';
import type { Json } from '../../../lib/database.types';
import { useLookups } from '../hooks';
import { personName, todayIso } from '../lib';

type StepKey = 'requisition' | 'information' | 'status' | 'more';

const STEPS: { key: StepKey; title: string }[] = [
  { key: 'requisition', title: 'Requisition' },
  { key: 'information', title: 'Candidate Information' },
  { key: 'status', title: 'Main Status Details' },
  { key: 'more', title: 'More Details' },
];

interface RequisitionChoice {
  id: string;
  display_code: string;
  title: string;
  status: string;
  company_name: string | null;
}

interface Duplicate {
  id: string;
  name: string;
  detail: string;
  reason: string;
  isCandidate: boolean;
}

const EMPTY_FORM = {
  firstName: '',
  middleName: '',
  lastName: '',
  headline: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  country: '',
  linkedin: '',
  statusId: '',
  sourceId: '',
  sourcerId: '',
  referredBy: '',
  initialDate: '',
  currentTitle: '',
  currentEmployer: '',
  tenureNote: '',
  expectedSalary: '',
  currentSalary: '',
  salaryCurrency: '',
  salaryFlag: '',
  gradeComment: '',
  university: '',
  discipline: '',
  eduYear: '',
  higherDegrees: '',
  otherDegrees: '',
  expTitle: '',
  expEmployer: '',
  expStart: '',
  expEnd: '',
  expDescription: '',
};

type Form = typeof EMPTY_FORM;

function likeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function compact(entry: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(entry).filter(([, v]) => v.trim() !== ''));
}

function nullable(value: string): string | null {
  const t = value.trim();
  return t === '' ? null : t;
}

export function CandidateNewPage() {
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const lookups = useLookups();

  const [form, setForm] = useState<Form>({ ...EMPTY_FORM, initialDate: todayIso() });
  const [starGrade, setStarGrade] = useState<number | null>(null);
  const [doNotContact, setDoNotContact] = useState(false);
  const [requisitions, setRequisitions] = useState<RequisitionChoice[]>([]);
  const [requisitionId, setRequisitionId] = useState('');
  const [requisitionQuery, setRequisitionQuery] = useState('');
  const [current, setCurrent] = useState(0);
  const [reached, setReached] = useState(0);
  const [skipped, setSkipped] = useState<StepKey[]>([]);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [checkedKey, setCheckedKey] = useState('');
  const [problems, setProblems] = useState<FieldError[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canCreate = role === 'admin' || role === 'recruiter';

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from('requisition_list')
      .select('id, display_code, title, status, company_name')
      .in('status', ['open', 'waiting_approval', 'on_hold'])
      .order('title', { ascending: true })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) setError(err.message);
        else setRequisitions((data as RequisitionChoice[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chosen = requisitions.find((r) => r.id === requisitionId) ?? null;

  const visibleRequisitions = useMemo(() => {
    const q = requisitionQuery.trim().toLowerCase();
    const list = q
      ? requisitions.filter((r) =>
          `${r.title} ${r.display_code} ${r.company_name ?? ''}`.toLowerCase().includes(q),
        )
      : requisitions;
    return list.slice(0, 50);
  }, [requisitions, requisitionQuery]);

  const namesFilled = form.firstName.trim() !== '' && form.lastName.trim() !== '';

  const checkDuplicates = async () => {
    const first = form.firstName.trim();
    const last = form.lastName.trim();
    const email = form.email.trim().toLowerCase();
    if (!first || !last) {
      setDuplicates([]);
      setCheckedKey('');
      return;
    }
    const key = `${first.toLowerCase()}|${last.toLowerCase()}|${email}`;
    if (key === checkedKey) return;
    setCheckedKey(key);
    const found = new Map<string, Duplicate>();
    const select = 'id, first_name, middle_name, last_name, headline, city';
    const byName = await supabase
      .from('people')
      .select(select)
      .ilike('first_name', likeLiteral(first))
      .ilike('last_name', likeLiteral(last))
      .limit(10);
    for (const p of byName.data ?? []) {
      found.set(p.id, {
        id: p.id,
        name: personName(p),
        detail: [p.headline, p.city].filter(Boolean).join(' · '),
        reason: 'Same name',
        isCandidate: false,
      });
    }
    if (email !== '' && EMAIL_PATTERN.test(email)) {
      const byEmail = await supabase
        .from('people')
        .select(select)
        .filter('emails', 'cs', JSON.stringify([{ address: email }]))
        .limit(10);
      for (const p of byEmail.data ?? []) {
        const prior = found.get(p.id);
        found.set(p.id, {
          id: p.id,
          name: personName(p),
          detail: [p.headline, p.city].filter(Boolean).join(' · '),
          reason: prior ? 'Same name and email' : 'Same email',
          isCandidate: false,
        });
      }
    }
    const ids = [...found.keys()];
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('candidate_profiles')
        .select('person_id, current_title, current_employer')
        .in('person_id', ids);
      for (const prof of profiles ?? []) {
        const dup = found.get(prof.person_id);
        if (!dup) continue;
        dup.isCandidate = true;
        const where = [prof.current_title, prof.current_employer].filter(Boolean).join(' at ');
        if (where) dup.detail = where;
      }
    }
    setDuplicates([...found.values()]);
  };

  const advance = (from: number, skip: boolean) => {
    const stepKey = STEPS[from]?.key;
    if (stepKey === undefined) return;
    setSkipped((s) => {
      const without = s.filter((k) => k !== stepKey);
      return skip ? [...without, stepKey] : without;
    });
    const next = Math.min(from + 1, STEPS.length - 1);
    setReached((r) => Math.max(r, next));
    setCurrent(next);
  };

  const continueFromInformation = async () => {
    const found: FieldError[] = [];
    if (form.firstName.trim() === '') found.push({ field: 'cand-first-name', message: 'First name is required.' });
    if (form.lastName.trim() === '') found.push({ field: 'cand-last-name', message: 'Last name is required.' });
    if (form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim())) {
      found.push({ field: 'cand-email', message: 'Enter a valid email address.' });
    }
    if (form.phone.trim() !== '' && !PHONE_PATTERN.test(form.phone.trim())) {
      found.push({ field: 'cand-phone', message: PHONE_RULE });
    }
    setProblems(found);
    if (found.length > 0) return;
    await checkDuplicates();
    advance(1, false);
  };

  const chooseRequisition = (id: string) => {
    setRequisitionId(id);
    advance(0, false);
  };

  const create = async (e?: FormEvent) => {
    e?.preventDefault();
    const found: FieldError[] = [];
    if (!namesFilled) {
      found.push({
        field: form.firstName.trim() === '' ? 'cand-first-name' : 'cand-last-name',
        message: 'First name and last name are required.',
      });
    }
    if (form.email.trim() !== '' && !EMAIL_PATTERN.test(form.email.trim())) {
      found.push({ field: 'cand-email', message: 'Enter a valid email address.' });
    }
    if (form.phone.trim() !== '' && !PHONE_PATTERN.test(form.phone.trim())) {
      found.push({ field: 'cand-phone', message: PHONE_RULE });
    }
    for (const [field, label, value] of [
      ['cand-expected-salary', 'Expected salary', form.expectedSalary],
      ['cand-current-salary', 'Current salary', form.currentSalary],
    ] as const) {
      if (value.trim() !== '' && Number.isNaN(Number(value))) {
        found.push({ field, message: `${label} must be a number.` });
      }
    }
    setProblems(found);
    if (found.length > 0) {
      const info = found.some((p) => p.field?.startsWith('cand-') && !p.field.includes('salary'));
      setCurrent(info ? 1 : 3);
      setReached((r) => Math.max(r, info ? 1 : 3));
      return;
    }

    setSaving(true);
    setError(null);
    const email = form.email.trim().toLowerCase();
    const education = compact({
      university: form.university,
      bachelor_discipline: form.discipline,
      year: form.eduYear,
      higher_degrees: form.higherDegrees,
      other_degrees: form.otherDegrees,
    });
    const experience = compact({
      title: form.expTitle,
      employer: form.expEmployer,
      start_date: form.expStart,
      end_date: form.expEnd,
      description: form.expDescription,
    });

    try {
      const { data: person, error: personError } = await supabase
        .from('people')
        .insert({
          first_name: form.firstName.trim(),
          middle_name: nullable(form.middleName),
          last_name: form.lastName.trim(),
          headline: nullable(form.headline),
          emails: email ? [{ type: 'work', address: email }] : [],
          phones: form.phone.trim() ? [{ type: 'work', number: form.phone.trim() }] : [],
          city: nullable(form.city),
          state: nullable(form.state),
          country: nullable(form.country),
          linkedin_public_url: nullable(form.linkedin),
          education: (Object.keys(education).length > 0 ? [education] : []) as Json,
          experience: (Object.keys(experience).length > 0 ? [experience] : []) as Json,
          created_by: staff?.id ?? null,
        })
        .select('id')
        .single();
      if (personError || !person) throw new Error(personError?.message ?? 'Could not create the person.');

      const { error: profileError } = await supabase.from('candidate_profiles').insert({
        person_id: person.id,
        status_id: form.statusId || null,
        source_id: form.sourceId || null,
        sourcer_id: form.sourcerId || null,
        referred_by: nullable(form.referredBy),
        initial_date: form.initialDate || null,
        current_title: nullable(form.currentTitle),
        current_employer: nullable(form.currentEmployer),
        tenure_note: nullable(form.tenureNote),
        expected_salary: form.expectedSalary.trim() ? Number(form.expectedSalary) : null,
        current_salary: form.currentSalary.trim() ? Number(form.currentSalary) : null,
        salary_currency: nullable(form.salaryCurrency),
        salary_flag: nullable(form.salaryFlag),
        star_grade: starGrade,
        grade_comment: nullable(form.gradeComment),
        do_not_contact: doNotContact,
      });
      if (profileError) {
        await supabase.from('people').delete().eq('id', person.id);
        throw new Error(profileError.message);
      }

      if (requisitionId !== '') {
        const { error: appError } = await supabase.from('applications').insert({
          requisition_id: requisitionId,
          person_id: person.id,
          stage: 'received',
          source_id: form.sourceId || null,
        });
        if (appError) {
          setCreatedId(person.id);
          throw new Error(
            `The candidate was created, but could not be added to the requisition: ${appError.message}`,
          );
        }
      }
      navigate(`/recruit/candidates/${person.id}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const problemFor = (field: string) => problems.find((p) => p.field === field)?.message;

  const summary = (key: StepKey): string => {
    if (skipped.includes(key)) return 'Skipped';
    switch (key) {
      case 'requisition':
        return chosen ? chosen.title : 'No requisition';
      case 'information':
        return namesFilled ? `${form.firstName.trim()} ${form.lastName.trim()}` : 'Not filled in yet';
      case 'status': {
        const bits = [
          lookups.statuses.find((s) => s.id === form.statusId)?.label,
          lookups.sources.find((s) => s.id === form.sourceId)?.name,
        ].filter(Boolean);
        return bits.length > 0 ? bits.join(' · ') : 'Nothing set';
      }
      case 'more':
        return 'Added';
    }
  };

  const stepBody = (key: StepKey): ReactNode => {
    switch (key) {
      case 'requisition':
        return (
          <>
            <p className="field-hint">
              Pick the requisition this candidate is applying to, or skip it. You can add one later
              from the candidate record.
            </p>
            <Input
              label="Search requisitions"
              value={requisitionQuery}
              onChange={(e) => setRequisitionQuery(e.target.value)}
              placeholder="Title, code or company"
            />
            <div className="cand-req-list" role="radiogroup" aria-label="Requisition">
              {visibleRequisitions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={r.id === requisitionId}
                  className="cand-req-card"
                  data-selected={r.id === requisitionId ? 'true' : 'false'}
                  onClick={() => chooseRequisition(r.id)}
                >
                  <span className="cand-req-title">{r.title}</span>
                  <span className="cand-req-meta">
                    {r.display_code}
                    {r.company_name ? ` · ${r.company_name}` : ''}
                  </span>
                  <StatusBadge status={r.status} />
                </button>
              ))}
              {visibleRequisitions.length === 0 && (
                <p className="field-hint">No open requisitions match.</p>
              )}
            </div>
          </>
        );
      case 'information':
        return (
          <>
            <div className="cand-step-grid">
              <Input
                id="cand-first-name"
                label="First name"
                required
                value={form.firstName}
                error={problemFor('cand-first-name')}
                onChange={(e) => set('firstName', e.target.value)}
                onBlur={() => void checkDuplicates()}
                autoFocus
              />
              <Input
                label="Middle name"
                value={form.middleName}
                onChange={(e) => set('middleName', e.target.value)}
              />
              <Input
                id="cand-last-name"
                label="Last name"
                required
                value={form.lastName}
                error={problemFor('cand-last-name')}
                onChange={(e) => set('lastName', e.target.value)}
                onBlur={() => void checkDuplicates()}
              />
              <Input
                label="Headline"
                value={form.headline}
                onChange={(e) => set('headline', e.target.value)}
              />
              <Input
                id="cand-email"
                label="Email"
                type="email"
                value={form.email}
                error={problemFor('cand-email')}
                onChange={(e) => set('email', e.target.value)}
                onBlur={() => void checkDuplicates()}
              />
              <Input
                id="cand-phone"
                label="Phone"
                type="tel"
                value={form.phone}
                error={problemFor('cand-phone')}
                onChange={(e) => set('phone', e.target.value)}
              />
              <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
              <Input label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
              <Input
                label="Country"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              />
              <Input
                label="LinkedIn public URL"
                type="url"
                value={form.linkedin}
                onChange={(e) => set('linkedin', e.target.value)}
              />
            </div>
            {duplicates.length > 0 && (
              <div className="cand-dup" role="alert">
                <span className="cand-dup-title">
                  {duplicates.length === 1
                    ? 'A person like this is already on file'
                    : `${duplicates.length} people like this are already on file`}
                </span>
                {duplicates.map((d) => (
                  <div key={d.id} className="cand-dup-row">
                    <span>
                      {d.name}
                      {d.detail ? ` · ${d.detail}` : ''} · {d.reason}
                    </span>
                    {d.isCandidate ? (
                      <Link
                        className="cand-dup-link"
                        to={`/recruit/candidates/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open existing candidate
                      </Link>
                    ) : (
                      <span className="field-hint">Not a candidate yet</span>
                    )}
                  </div>
                ))}
                <span className="field-hint">
                  You can still continue. Only create a new record if this is a different person.
                </span>
              </div>
            )}
          </>
        );
      case 'status':
        return (
          <div className="cand-step-grid">
            <Select
              label="Main status"
              placeholder="No status"
              options={lookups.statuses
                .filter((s) => s.is_active)
                .map((s) => ({ value: s.id, label: s.label }))}
              value={form.statusId}
              onChange={(e) => set('statusId', e.target.value)}
            />
            <DateField
              label="Initial date"
              value={form.initialDate}
              onChange={(e) => set('initialDate', e.target.value)}
            />
            <Select
              label="Source"
              placeholder="No source"
              options={lookups.sources.map((s) => ({ value: s.id, label: s.name }))}
              value={form.sourceId}
              onChange={(e) => set('sourceId', e.target.value)}
            />
            <Select
              label="Sourcer"
              placeholder="No sourcer"
              options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
              value={form.sourcerId}
              onChange={(e) => set('sourcerId', e.target.value)}
            />
            <Input
              label="Referred by"
              value={form.referredBy}
              onChange={(e) => set('referredBy', e.target.value)}
            />
          </div>
        );
      case 'more':
        return (
          <>
            <h3 className="cand-step-subhead">Current role and salary</h3>
            <div className="cand-step-grid">
              <Input
                label="Current title"
                value={form.currentTitle}
                onChange={(e) => set('currentTitle', e.target.value)}
              />
              <Input
                label="Current employer"
                value={form.currentEmployer}
                onChange={(e) => set('currentEmployer', e.target.value)}
              />
              <Input
                label="Tenure note"
                value={form.tenureNote}
                onChange={(e) => set('tenureNote', e.target.value)}
              />
              <Input
                label="Salary flag"
                value={form.salaryFlag}
                onChange={(e) => set('salaryFlag', e.target.value)}
              />
              <Input
                id="cand-expected-salary"
                label="Expected salary"
                type="number"
                value={form.expectedSalary}
                error={problemFor('cand-expected-salary')}
                onChange={(e) => set('expectedSalary', e.target.value)}
              />
              <Input
                id="cand-current-salary"
                label="Current salary"
                type="number"
                value={form.currentSalary}
                error={problemFor('cand-current-salary')}
                onChange={(e) => set('currentSalary', e.target.value)}
              />
              <Select
                label="Salary currency"
                placeholder="Not set"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                value={form.salaryCurrency}
                onChange={(e) => set('salaryCurrency', e.target.value)}
              />
            </div>
            <h3 className="cand-step-subhead">Grading</h3>
            <div className="cand-step-grid">
              <div className="field">
                <span className="field-label">Amir Grade (star grade)</span>
                <StarGrade value={starGrade} onChange={setStarGrade} />
              </div>
              <Input
                label="Sourcer Grade (grade comment)"
                value={form.gradeComment}
                onChange={(e) => set('gradeComment', e.target.value)}
              />
            </div>
            <h3 className="cand-step-subhead">Education</h3>
            <div className="cand-step-grid">
              <Input
                label="University"
                value={form.university}
                onChange={(e) => set('university', e.target.value)}
              />
              <Input
                label="Bachelor Discipline"
                value={form.discipline}
                onChange={(e) => set('discipline', e.target.value)}
              />
              <Input label="Year" value={form.eduYear} onChange={(e) => set('eduYear', e.target.value)} />
              <Input
                label="Higher Degrees"
                value={form.higherDegrees}
                onChange={(e) => set('higherDegrees', e.target.value)}
              />
              <Input
                label="Other Degrees"
                value={form.otherDegrees}
                onChange={(e) => set('otherDegrees', e.target.value)}
              />
            </div>
            <h3 className="cand-step-subhead">Experience</h3>
            <div className="cand-step-grid">
              <Input
                label="Title"
                value={form.expTitle}
                onChange={(e) => set('expTitle', e.target.value)}
              />
              <Input
                label="Employer"
                value={form.expEmployer}
                onChange={(e) => set('expEmployer', e.target.value)}
              />
              <Input
                label="Start Date"
                value={form.expStart}
                onChange={(e) => set('expStart', e.target.value)}
              />
              <Input
                label="End Date"
                value={form.expEnd}
                onChange={(e) => set('expEnd', e.target.value)}
              />
              <Input
                label="Description"
                value={form.expDescription}
                onChange={(e) => set('expDescription', e.target.value)}
              />
            </div>
            <label className="checkline">
              <input
                type="checkbox"
                checked={doNotContact}
                onChange={(e) => setDoNotContact(e.target.checked)}
              />
              Do not contact
            </label>
            <span className="field-hint">
              More entries for education and experience can be added on the candidate record.
            </span>
          </>
        );
    }
  };

  if (!canCreate) {
    return (
      <RecordPage
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Candidates', to: '/recruit/candidates' },
          { label: 'New candidate' },
        ]}
        title="Candidates: New Candidate"
        icon={<UserPlus size={32} />}
      >
        <p className="text-secondary">Only admins and recruiters can add candidates.</p>
      </RecordPage>
    );
  }

  return (
    <RecordPage
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Candidates', to: '/recruit/candidates' },
        { label: 'New candidate' },
      ]}
      title="Candidates: New Candidate"
      icon={<UserPlus size={32} />}
    >
      <form className="cand-new" noValidate onSubmit={(e) => void create(e)}>
        {STEPS.map((step, i) => {
          if (i > reached) return null;
          const open = i === current;
          const last = i === STEPS.length - 1;
          return (
            <section
              key={step.key}
              className="cand-step"
              data-open={open ? 'true' : 'false'}
              aria-label={step.title}
            >
              <div className="cand-step-head">
                <span className="cand-step-num" aria-hidden="true">
                  {i !== current ? <Check size={20} /> : i + 1}
                </span>
                <h2 className="cand-step-title">{step.title}</h2>
                {!open && <span className="cand-step-summary">{summary(step.key)}</span>}
                {!open && (
                  <Button size="sm" variant="ghost" onClick={() => setCurrent(i)}>
                    Edit
                  </Button>
                )}
              </div>
              {open && (
                <div className="cand-step-body">
                  {stepBody(step.key)}
                  {!last && (
                    <div className="cand-step-actions">
                      {step.key !== 'information' && (
                        <Button variant="ghost" onClick={() => advance(i, true)}>
                          Skip
                        </Button>
                      )}
                      {step.key === 'information' ? (
                        <Button onClick={() => void continueFromInformation()}>Continue</Button>
                      ) : (
                        step.key !== 'requisition' && (
                          <Button onClick={() => advance(i, false)}>Continue</Button>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}

        <ErrorSummary errors={problems} />
        {error !== null && (
          <div className="form-error" role="alert">
            {error}
            {createdId !== null && (
              <>
                {' '}
                <Link to={`/recruit/candidates/${createdId}`}>Open the candidate</Link>
              </>
            )}
          </div>
        )}
        <div className="cand-new-actions">
          <Button
            variant="primary"
            type="submit"
            loading={saving}
            disabled={!namesFilled}
            title={namesFilled ? undefined : 'Enter a first and last name to create the candidate'}
          >
            {saving ? 'Creating…' : 'Create candidate'}
          </Button>
          <Button onClick={() => navigate('/recruit/candidates')}>Cancel</Button>
        </div>
      </form>
    </RecordPage>
  );
}
