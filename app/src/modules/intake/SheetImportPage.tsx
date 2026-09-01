import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RecordSection } from '../../components/ui/RecordPage';
import { InboxIcon } from '../../shell/icons';
import { db as supabase } from './db';
import { checkDedup } from './hooks';

const PARSED_FIELDS = [
  { key: 'name', label: 'Name' },
  { key: 'headline', label: 'Headline' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
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

export function SheetImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [targetType, setTargetType] = useState<'candidate' | 'contact'>('contact');
  const [batchLabel, setBatchLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FetchResult | null>(null);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
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

  async function doFetch() {
    if (!url.trim()) {
      setError('Enter a Google Sheet URL or a hosted .xlsx/.csv URL.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke('intake-sheet-fetch', {
      body: { url: url.trim() },
    });
    setBusy(false);
    if (err || data?.error) {
      setError(data?.error ?? err?.message ?? 'Could not fetch the sheet.');
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

  async function goToPreview() {
    if (!fetched) return;
    if (!batchLabel.trim()) {
      setError('A batch label is required.');
      return;
    }
    if (!columnMap.name && !columnMap.email) {
      setError('Map at least a name or email column before continuing.');
      return;
    }
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
        batchLabel: batchLabel.trim(),
        saveTemplate: saveTemplateName.trim()
          ? { name: saveTemplateName.trim(), sourceHint: fetched.suggestedTemplateHint }
          : undefined,
      },
    });
    setBusy(false);
    if (err || data?.error) {
      setError(data?.error ?? err?.message ?? 'Import failed.');
      return;
    }
    setCreated(data.created ?? 0);
    setStep('done');
  }

  if (step === 'done') {
    return (
      <div className="record-page intake-sheet-page">
        <div className="record-title-row">
          <span className="taleo-page-icon">
            <InboxIcon size={40} />
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
          <span className="taleo-page-icon">
            <InboxIcon size={40} />
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
                  <th>Company</th>
                  <th>Dedup</th>
                </tr>
              </thead>
              <tbody>
                {fetched.rows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{columnMap.name ? row[columnMap.name] : ''}</td>
                    <td>{columnMap.email ? row[columnMap.email] : ''}</td>
                    <td>{columnMap.company ? row[columnMap.company] : ''}</td>
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
          {error && <p className="field-error-text">{error}</p>}
          <div className="intake-form-actions">
            <Button variant="primary" onClick={commit} disabled={busy || checkingDedup}>
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
          <span className="taleo-page-icon">
            <InboxIcon size={40} />
          </span>
          <h1>Intake: Map Columns</h1>
        </div>

        <RecordSection title="Column Mapping:">
          <p className="text-secondary">
            Sample of {fetched.rows.length} row(s). Unmapped columns stay in the raw payload.
          </p>

          {templates.length > 0 && (
            <div className="field">
              <label className="field-label">Recall a saved mapping</label>
              <Select
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
          <Input
            label="Batch label"
            required
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            placeholder="Q3 partner list import"
          />

          {PARSED_FIELDS.map((f) => (
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

          {error && <p className="field-error-text">{error}</p>}
          <div className="intake-form-actions">
            <Button variant="primary" onClick={goToPreview} disabled={busy}>
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
        <span className="taleo-page-icon">
          <InboxIcon size={40} />
        </span>
        <h1>Intake: Import a Sheet</h1>
      </div>
      <RecordSection title="Sheet Source:">
        <p className="text-secondary">A Google Sheet URL (any sharing link) or a hosted .xlsx/.csv URL.</p>
        <Input
          label="Sheet URL"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…"
        />
        {error && <p className="field-error-text">{error}</p>}
        <div className="intake-form-actions">
          <Button variant="primary" onClick={doFetch} disabled={busy}>
            Fetch
          </Button>
          <Button onClick={() => navigate('/intake')}>Cancel</Button>
        </div>
      </RecordSection>
    </div>
  );
}
