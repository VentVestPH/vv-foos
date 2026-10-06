import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RecordSection } from '../../components/ui/RecordPage';
import { ErrorSummary, type FieldError } from '../../components/ui/ErrorSummary';
import { Inbox as InboxIcon, Sheet as SheetIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { downloadCsv } from '../../lib/csv';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { checkDedup } from './hooks';
import { useRole } from '../../auth/SessionProvider';
import { EMAIL_PATTERN, PHONE_PATTERN } from '../../lib/personValidation';

const TEMPLATE_EXAMPLE: Record<string, string> = {
  first_name: 'Marisol',
  last_name: 'Reyes',
  headline: 'Staff Platform Engineer',
  email: 'marisol.reyes@example.com',
  phone: '+63 917 555 0142',
  current_employer: 'Northwind Logistics',
  current_title: 'Staff Platform Engineer',
  country: 'Philippines',
  requisition: 'REQ-000123',
  candidate_status: 'Talent Pool',
  tenure_note: '4 years in current role',
  expected_salary: '120000',
  current_salary: '100000',
  salary_currency: 'PHP',
  salary_flag: 'Flexible',
  university: 'University of the Philippines',
  bachelor_discipline: 'Computer Science',
  education_year: '2018',
  higher_degrees: '',
  other_degrees: '',
  experience_title: 'Staff Platform Engineer',
  experience_employer: 'Northwind Logistics',
  experience_start_date: '2022-01',
  experience_end_date: 'Present',
  experience_description: 'Platform engineering leadership',
  linkedin_url: 'https://www.linkedin.com/in/marisol-reyes',
};

const PARSED_FIELDS = [
  { key: 'name', label: 'Full name' },
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'headline', label: 'Headline' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'current_employer', label: 'Current employer' },
  { key: 'company', label: 'Company (contact import)' },
  { key: 'current_title', label: 'Current title' },
  { key: 'country', label: 'Country' },
  { key: 'requisition', label: 'Requisition code' },
  { key: 'candidate_status', label: 'Main status' },
  { key: 'tenure_note', label: 'Tenure note' },
  { key: 'expected_salary', label: 'Expected salary' },
  { key: 'current_salary', label: 'Current salary' },
  { key: 'salary_currency', label: 'Salary currency' },
  { key: 'salary_flag', label: 'Salary flag' },
  { key: 'university', label: 'University' },
  { key: 'bachelor_discipline', label: 'Bachelor discipline' },
  { key: 'education_year', label: 'Education year' },
  { key: 'higher_degrees', label: 'Higher degrees' },
  { key: 'other_degrees', label: 'Other degrees' },
  { key: 'experience_title', label: 'Experience title' },
  { key: 'experience_employer', label: 'Experience employer' },
  { key: 'experience_start_date', label: 'Experience start date' },
  { key: 'experience_end_date', label: 'Experience end date' },
  { key: 'experience_description', label: 'Experience description' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
] as const;

type Step = 'url' | 'mapping' | 'preview' | 'done';

interface FetchResult {
  columns: string[];
  rows: Record<string, string>[];
  suggestedTemplateHint: string;
}

interface MappingTemplate {
  id: string;
  name: string;
  source_hint: string | null;
  column_map: Record<string, string>;
  target_type: 'candidate' | 'contact';
}

interface RequisitionOption {
  id: string;
  display_code: string;
  title: string;
  status: string;
}

function downloadTemplate(): void {
  downloadCsv(
    'intake-sheet-template.csv',
    [TEMPLATE_EXAMPLE],
    PARSED_FIELDS.map((f) => ({ key: f.key, header: f.label })),
  );
}

export function SheetImportPage() {
  useDocumentTitle('Intake: Sheet import');
  const navigate = useNavigate();
  const role = useRole();
  const canAssignRequisition = role === 'admin' || role === 'recruiter';
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [targetType, setTargetType] = useState<'candidate' | 'contact'>('candidate');
  const [batchLabel, setBatchLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<FieldError[]>([]);
  const [fetched, setFetched] = useState<FetchResult | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionOption[]>([]);
  const [defaultRequisitionId, setDefaultRequisitionId] = useState('');
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [dedupFlags, setDedupFlags] = useState<Map<number, string>>(new Map());
  const [checkingDedup, setCheckingDedup] = useState(false);
  const [created, setCreated] = useState(0);

  useEffect(() => {
    supabase
      .from('intake_mapping_templates')
      .select('*')
      .eq('target_type', targetType)
      .order('created_at', { ascending: false })
      .then(({ data }) => setTemplates((data as MappingTemplate[]) ?? []));
  }, [targetType]);

  useEffect(() => {
    if (targetType !== 'candidate' || !canAssignRequisition) {
      setRequisitions([]);
      setDefaultRequisitionId('');
      return;
    }
    let cancelled = false;
    void supabase
      .from('requisition_list')
      .select('id, display_code, title, status')
      .in('status', ['open', 'waiting_approval', 'on_hold'])
      .order('display_code', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) setRequisitions((data as RequisitionOption[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [targetType, canAssignRequisition]);

  async function doFetch() {
    if (!url.trim()) {
      setProblems([
        { field: 'sheet-url', message: 'Enter a Google Sheet URL or a hosted .xlsx/.csv URL.' },
      ]);
      return;
    }
    setProblems([]);
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('intake-sheet-fetch', {
      body: { url: url.trim() },
    });
    setBusy(false);
    const shaped =
      data !== null &&
      typeof data === 'object' &&
      Array.isArray((data as FetchResult).columns) &&
      Array.isArray((data as FetchResult).rows);
    if (err || data?.error || !shaped) {
      setError(
        data?.error ??
          err?.message ??
          'Could not read that sheet. The fetch returned an unexpected response.',
      );
      return;
    }
    setFetched(data as FetchResult);

    const suggested = templates.find(
      (t) => t.source_hint && data.suggestedTemplateHint?.toLowerCase().includes(t.source_hint.toLowerCase()),
    );
    setColumnMap(suggested?.column_map ?? {});
    setStep('mapping');
  }

  function applyTemplate(id: string) {
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setColumnMap(tpl.column_map);
  }

  function requisitionForRow(row: Record<string, string>): RequisitionOption | undefined {
    const code = columnMap.requisition ? row[columnMap.requisition]?.trim() : '';
    if (code) return requisitions.find((req) => req.display_code.toLowerCase() === code.toLowerCase());
    return requisitions.find((req) => req.id === defaultRequisitionId);
  }

  async function goToPreview() {
    if (!fetched) return;
    const found: FieldError[] = [];
    if (!batchLabel.trim()) {
      found.push({ field: 'sheet-batch-label', message: 'A batch label is required.' });
    }
    if (targetType === 'candidate') {
      if ((!columnMap.name && !columnMap.first_name) || (!columnMap.name && !columnMap.last_name)) {
        found.push({ message: 'Map first and last name columns, or map a full name column.' });
      }
      if (!columnMap.email) found.push({ message: 'Map an email column for candidate imports.' });
      if (!canAssignRequisition && columnMap.requisition) {
        found.push({ message: 'Only an admin or recruiter can attach candidates to a requisition.' });
      }
      if (columnMap.email) {
        fetched.rows.forEach((row, index) => {
          const name = columnMap.name ? row[columnMap.name]?.trim() ?? '' : '';
          const names = name.split(/\s+/).filter(Boolean);
          const first = (columnMap.first_name ? row[columnMap.first_name]?.trim() : '') || names[0] || '';
          const last = (columnMap.last_name ? row[columnMap.last_name]?.trim() : '') || names.slice(1).join(' ');
          const email = row[columnMap.email]?.trim() ?? '';
          if (!first || !last) found.push({ message: `Row ${index + 2}: first and last name are required.` });
          if (!EMAIL_PATTERN.test(email)) {
            found.push({ message: `Row ${index + 2}: enter a valid email address.` });
          }
          const phoneColumn = columnMap.phone;
          const phone = phoneColumn ? row[phoneColumn]?.trim() ?? '' : '';
          if (phone && !PHONE_PATTERN.test(phone)) {
            found.push({ message: `Row ${index + 2}: phone contains unsupported characters.` });
          }
          const requisitionCode = columnMap.requisition ? row[columnMap.requisition]?.trim() : '';
          if (requisitionCode && !requisitionForRow(row)) {
            found.push({ message: `Row ${index + 2}: requisition ${requisitionCode} is not available.` });
          }
        });
      }
    } else if (!columnMap.name && !columnMap.email) {
      found.push({ message: 'Map at least a name or email column before continuing.' });
    }
    setProblems(found);
    if (found.length > 0) return;
    setError(null);
    setStep('preview');
    setCheckingDedup(true);
    const flags = new Map<number, string>();
    for (let i = 0; i < fetched.rows.length; i++) {
      const row = fetched.rows[i];
      const email = columnMap.email ? row[columnMap.email] : undefined;
      const linkedin = columnMap.linkedin_url ? row[columnMap.linkedin_url] : undefined;
      if (!email && !linkedin) continue;
      const match = await checkDedup({
        parsed: { email, linkedin_url: linkedin },
        linkedin_url: linkedin ?? null,
      });
      if (match) flags.set(i, match.name);
    }
    setDedupFlags(flags);
    setCheckingDedup(false);
  }

  async function commit() {
    if (!fetched) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('intake-sheet-commit', {
      body: {
        rows: fetched.rows,
        columnMap,
        targetType,
        requisitionId: targetType === 'candidate' ? defaultRequisitionId || undefined : undefined,
        batchLabel: batchLabel.trim(),
        saveTemplate: saveTemplateName.trim()
          ? { name: saveTemplateName.trim(), sourceHint: fetched.suggestedTemplateHint }
          : undefined,
      },
    });
    setBusy(false);
    if (err || data?.error || data === null || typeof data !== 'object') {
      setError(
        data?.error ?? err?.message ?? 'Import failed. The commit returned an unexpected response.',
      );
      return;
    }
    setCreated(typeof data.created === 'number' ? data.created : 0);
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="record-page intake-sheet-page">
        <div className="record-title-row">
          <span className="fo-page-icon">
            <InboxIcon size={32} />
          </span>
          <h1>Intake: Sheet Staged</h1>
        </div>
        <p className="text-secondary">
          {created} intake item(s) created under batch "{batchLabel}".
        </p>
        <Button variant="primary" onClick={() => navigate('/intake')}>
          Go to queue
        </Button>
      </div>
    );
  }

  if (step === 'preview' && fetched) {
    return (
      <div className="record-page intake-sheet-page">
        <div className="record-title-row">
          <span className="fo-page-icon">
            <InboxIcon size={32} />
          </span>
          <h1>Intake: Preview ({fetched.rows.length} rows)</h1>
        </div>
        <RecordSection title="Preview:">
          {checkingDedup && <p className="text-secondary">Checking for duplicates…</p>}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Current employer</th>
                  <th>Requisition</th>
                  <th>Dedup</th>
                </tr>
              </thead>
              <tbody>
                {fetched.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      {columnMap.name
                        ? row[columnMap.name]
                        : [columnMap.first_name ? row[columnMap.first_name] : '', columnMap.last_name ? row[columnMap.last_name] : ''].filter(Boolean).join(' ')}
                    </td>
                    <td>{columnMap.email ? row[columnMap.email] : ''}</td>
                    <td>{columnMap.current_employer ? row[columnMap.current_employer] : columnMap.company ? row[columnMap.company] : ''}</td>
                    <td>{requisitionForRow(row)?.display_code ?? ''}</td>
                    <td>
                      {dedupFlags.has(i) ? (
                        <span className="badge-tone badge-dup">matches {dedupFlags.get(i)}</span>
                      ) : (
                        ''
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <p className="field-error-text" role="alert">{error}</p>}
          <div className="intake-form-actions">
            <Button variant="primary" onClick={commit} loading={busy} disabled={checkingDedup}>
              Import all {fetched.rows.length} rows
            </Button>
            <Button onClick={() => setStep('mapping')} disabled={busy}>
              Back to mapping
            </Button>
          </div>
        </RecordSection>
      </div>
    );
  }

  if (step === 'mapping' && fetched) {
    return (
      <div className="record-page intake-sheet-page">
        <div className="record-title-row">
          <span className="fo-page-icon">
            <InboxIcon size={32} />
          </span>
          <h1>Intake: Map Columns</h1>
        </div>

        <RecordSection title="Column Mapping:">
          <ErrorSummary errors={problems} />
          <p className="text-secondary">
            Sample of {fetched.rows.length} row(s). Unmapped columns stay in the raw payload.
          </p>

          {templates.length > 0 && (
            <div className="field">
              <Select
                label="Recall a saved mapping"
                placeholder="Choose a template…"
                options={templates.map((t) => ({ value: t.id, label: t.name }))}
                onChange={(e) => applyTemplate(e.target.value)}
              />
            </div>
          )}

          <Select
            label="Target"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as 'candidate' | 'contact')}
            options={[
              { value: 'candidate', label: 'Candidate' },
              { value: 'contact', label: 'Contact' },
            ]}
          />
          {targetType === 'candidate' && canAssignRequisition && (
            <Select
              label="Add candidates to a requisition (optional)"
              placeholder="Leave unassigned"
              value={defaultRequisitionId}
              onChange={(e) => setDefaultRequisitionId(e.target.value)}
              options={requisitions.map((req) => ({
                value: req.id,
                label: `${req.display_code} · ${req.title}`,
              }))}
              emptyLabel="No open requisitions available"
            />
          )}
          <Input
            id="sheet-batch-label"
            label="Batch label"
            required
            error={problems.find((p) => p.field === 'sheet-batch-label')?.message}
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            placeholder="Q3 partner list import"
          />

          {PARSED_FIELDS.filter((field) => field.key !== 'requisition' || canAssignRequisition).map((f) => (
            <Select
              key={f.key}
              label={f.label}
              placeholder="— not mapped —"
              value={columnMap[f.key] ?? ''}
              onChange={(e) => setColumnMap((m) => ({ ...m, [f.key]: e.target.value }))}
              options={fetched.columns.map((c) => ({ value: c, label: c }))}
            />
          ))}

          <Input
            label="Save this mapping as a template (optional)"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            placeholder="e.g. Google Sheet — partner contacts"
          />

          {error && <p className="field-error-text" role="alert">{error}</p>}
          <div className="intake-form-actions">
            <Button variant="primary" onClick={goToPreview} loading={busy}>
              Continue to preview
            </Button>
            <Button onClick={() => navigate('/intake')}>Cancel</Button>
          </div>
        </RecordSection>

        <RecordSection title="Sample Rows:">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {fetched.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fetched.rows.slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {fetched.columns.map((c) => (
                      <td key={c}>{row[c]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RecordSection>
      </div>
    );
  }

  return (
    <div className="record-page intake-sheet-page">
      <div className="record-title-row">
        <span className="fo-page-icon">
          <InboxIcon size={32} />
        </span>
        <h1>Intake: Import a Sheet</h1>
      </div>
      <RecordSection title="Sheet Source:">
        <ErrorSummary errors={problems} />
        <p className="text-secondary">A Google Sheet URL (any sharing link) or a hosted .xlsx/.csv URL.</p>
        <Input
          id="sheet-url"
          label="Sheet URL"
          required
          error={problems.find((p) => p.field === 'sheet-url')?.message}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
        />
        {error && <p className="field-error-text" role="alert">{error}</p>}
        <div className="intake-form-actions">
          <Button variant="primary" onClick={doFetch} loading={busy}>
            Fetch
          </Button>
          <Button onClick={downloadTemplate}>
            <SheetIcon size={20} aria-hidden="true" />
            Download template
          </Button>
          <Button onClick={() => navigate('/intake')}>Cancel</Button>
        </div>
      </RecordSection>
    </div>
  );
}
