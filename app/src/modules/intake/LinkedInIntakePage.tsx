import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RecordSection } from '../../components/ui/RecordPage';
import { useSession } from '../../auth/SessionProvider';
import { supabase } from '../../lib/supabase';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { StarGrade } from '../../components/ui/StarGrade';
import { Inbox as InboxIcon } from 'lucide-react';

const EMPTY_URLS = '';
const EMPTY_BATCH_LABEL = '';
const EMPTY_TARGET_TYPE: 'candidate' | 'contact' = 'candidate';

export function LinkedInIntakePage() {
  useDocumentTitle('Intake: LinkedIn');
  const { staff } = useSession();
  const navigate = useNavigate();
  const [urls, setUrls] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [targetType, setTargetType] = useState<'candidate' | 'contact'>('candidate');
  const [stage, setStage] = useState<'input' | 'grading' | 'done'>('input');
  const [created, setCreated] = useState<
    { id: string; url: string; name: string; headline: string; company: string; title: string }[]
  >([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState<number | null>(null);
  const [gradeComment, setGradeComment] = useState('');

  function parseUrls(): string[] {
    return urls
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
  }

  async function stageBatch() {
    const list = parseUrls();
    if (list.length === 0) {
      setError('Paste at least one LinkedIn URL.');
      return;
    }
    if (!batchLabel.trim()) {
      setError('A batch label is required (e.g. "VVPH-3 Melbourne week 28").');
      return;
    }
    setBusy(true);
    setError(null);
    const rows = list.map((url) => ({
      channel: 'linkedin_url' as const,
      target_type: targetType,
      linkedin_url: url,
      batch_label: batchLabel.trim(),
      submitted_by: staff?.id ?? null,
      parsed: {},
      status: 'pending' as const,
    }));
    const { data, error: err } = await supabase.from('intake_items').insert(rows).select('id, linkedin_url');
    setBusy(false);
    if (err || !data) {
      setError(err?.message ?? 'Could not stage the batch.');
      return;
    }
    setCreated(
      data.map((d) => ({
        id: d.id,
        url: d.linkedin_url ?? '',
        name: '',
        headline: '',
        company: '',
        title: '',
      })),
    );
    resetItemFields();
    setStage(targetType === 'candidate' ? 'grading' : 'grading');
    setIndex(0);
  }

  function resetItemFields() {
    setName('');
    setHeadline('');
    setCompany('');
    setTitle('');
    setGrade(null);
    setGradeComment('');
  }

  async function saveCurrentAndNext() {
    const current = created[index];
    if (!current) return;
    if (targetType === 'candidate' && (grade == null || !gradeComment.trim())) {
      setError('Pick a star grade and add a grade comment before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    const update: Record<string, unknown> = {
      full_name: name || null,
      parsed: { name, headline, company, title },
      status: targetType === 'candidate' ? 'graded' : 'parsed',
    };
    if (targetType === 'candidate') {
      update.star_grade = grade;
      update.grade_comment = gradeComment.trim();
    }
    const { error: err } = await supabase
      .from('intake_items')
      .update(update as never)
      .eq('id', current.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (index + 1 < created.length) {
      setIndex(index + 1);
      resetItemFields();
    } else {
      setStage('done');
    }
  }

  if (stage === 'done') {
    return (
      <div className="record-page intake-linkedin-page">
        <div className="record-title-row">
          <span className="fo-page-icon">
            <InboxIcon size={40} />
          </span>
          <h1>Intake: Batch Staged</h1>
        </div>
        <p className="text-secondary">
          {created.length} item(s) from batch "{batchLabel}" are in the intake queue
          {targetType === 'candidate' ? ', graded and ready to import' : ', ready for review'}.
        </p>
        <Button variant="primary" onClick={() => navigate('/intake')}>
          Go to queue
        </Button>
      </div>
    );
  }

  if (stage === 'grading') {
    const current = created[index];
    return (
      <div className="record-page intake-linkedin-page">
        <div className="record-title-row">
          <span className="fo-page-icon">
            <InboxIcon size={40} />
          </span>
          <h1>
            Intake: {targetType === 'candidate' ? 'Grade' : 'Review'} item {index + 1} of {created.length}
          </h1>
        </div>
        <RecordSection title={`${targetType === 'candidate' ? 'Grading' : 'Review'}:`}>
          <p className="text-secondary">{current?.url}</p>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          <Input label="Current title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Current employer / company" value={company} onChange={(e) => setCompany(e.target.value)} />
          {targetType === 'candidate' && (
            <>
              <div className="field">
                <label className="field-label">
                  Star grade <span className="field-required">*</span>
                </label>
                <StarGrade value={grade} size={18} onChange={setGrade} />
              </div>
              <Input
                label="Grade comment"
                required
                value={gradeComment}
                onChange={(e) => setGradeComment(e.target.value)}
                placeholder="John's grading style"
              />
            </>
          )}
          {error && <p className="field-error-text">{error}</p>}
          <div className="intake-form-actions">
            <Button variant="primary" onClick={saveCurrentAndNext} disabled={busy}>
              {index + 1 < created.length ? 'Save & next' : 'Save & finish'}
            </Button>
            <Button onClick={() => navigate('/intake')}>Cancel</Button>
          </div>
        </RecordSection>
      </div>
    );
  }

  const actionButtons = (
    <div className="intake-form-actions">
      <Button variant="primary" onClick={stageBatch} disabled={busy}>
        Save &amp; Continue
      </Button>
      <Button onClick={() => navigate('/intake')}>Cancel</Button>
      <Button
        onClick={() => {
          setUrls(EMPTY_URLS);
          setBatchLabel(EMPTY_BATCH_LABEL);
          setTargetType(EMPTY_TARGET_TYPE);
          setError(null);
        }}
      >
        Reset
      </Button>
    </div>
  );

  return (
    <div className="record-page intake-linkedin-page">
      <div className="record-title-row">
        <span className="fo-page-icon">
          <InboxIcon size={40} />
        </span>
        <h1>Intake: Paste LinkedIn URLs</h1>
      </div>

      {actionButtons}

      <RecordSection title="Batch Details:">
        <p className="text-secondary">
          One URL per line (or comma-separated). Each becomes one intake item under the batch label below.
        </p>
        <div className="field">
          <label className="field-label" htmlFor="li-urls">
            LinkedIn URLs
          </label>
          <textarea
            id="li-urls"
            className="intake-url-textarea"
            rows={8}
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            placeholder={'https://linkedin.com/in/example-one\nhttps://linkedin.com/in/example-two'}
          />
        </div>
        <Input
          label="Batch label"
          required
          value={batchLabel}
          onChange={(e) => setBatchLabel(e.target.value)}
          placeholder="VVPH-3 Melbourne week 28"
        />
        <Select
          label="Target"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as 'candidate' | 'contact')}
          options={[
            { value: 'candidate', label: 'Candidate (grading required)' },
            { value: 'contact', label: 'Contact (no grading)' },
          ]}
        />
        {error && <p className="field-error-text">{error}</p>}
      </RecordSection>

      {actionButtons}
    </div>
  );
}
