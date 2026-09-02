import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RecordSection } from '../../../components/ui/RecordPage';
import { supabase } from '../../../lib/supabase';
import { checkDedup, type DedupMatch } from '../hooks';
import {
  CHANNEL_LABEL,
  canImport,
  canReject,
  isReadOnly,
  parsedOf,
  requiresGradingBeforeImport,
  STATUS_LABEL,
  type IntakeItem,
} from '../lib';
import { StarGrade } from '../../../components/ui/StarGrade';
import { Drawer } from './Drawer';

interface ItemDrawerProps {
  item: IntakeItem;
  onClose: () => void;

  onSaved: () => void;

  onDone: () => void;
}

export function ItemDrawer({ item, onClose, onSaved, onDone }: ItemDrawerProps) {
  const parsed = parsedOf(item);
  const [dedup, setDedup] = useState<DedupMatch | null | undefined>(undefined);
  const [mode, setMode] = useState<'new' | 'merge'>('new');
  const [grade, setGrade] = useState<number | null>(item.star_grade);
  const [gradeComment, setGradeComment] = useState(item.grade_comment ?? '');
  const [companyName, setCompanyName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    setDedup(undefined);
    if (!isReadOnly(item) && item.status !== 'imported') {
      checkDedup(item).then((match) => {
        setDedup(match);
        setMode(match ? 'merge' : 'new');
      });
    }
  }, [item]);

  const needsGrading = requiresGradingBeforeImport(item);
  const alreadyGraded = item.status === 'graded';

  async function saveGrade() {
    if (grade == null || !gradeComment.trim()) {
      setError('Pick a star grade and add a grade comment before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from('intake_items')
      .update({ star_grade: grade, grade_comment: gradeComment.trim(), status: 'graded' })
      .eq('id', item.id);
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      onSaved();
    }
  }

  async function doImport() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('import_intake_item', {
      p_intake_id: item.id,
      p_mode: mode,
      p_merge_person_id: mode === 'merge' ? (dedup?.personId ?? null) : null,
      p_new_company_name: item.target_type === 'contact' && !parsed.company ? companyName || null : null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      onDone();
    }
  }

  async function doReject() {
    if (!rejectReason.trim()) {
      setError('A reject reason is required.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('reject_intake_item', {
      p_intake_id: item.id,
      p_reason: rejectReason.trim(),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
    } else {
      onDone();
    }
  }

  return (
    <Drawer title={item.full_name || 'Intake item'} onClose={onClose}>
      <div className="intake-drawer-meta">
        <span className="badge-tone">{CHANNEL_LABEL[item.channel]}</span>
        <span className="badge-tone">{item.target_type}</span>
        <span className="badge-tone">{STATUS_LABEL[item.status]}</span>
        {item.batch_label && <span className="badge-tone">{item.batch_label}</span>}
      </div>

      {isReadOnly(item) && (
        <p className="intake-readonly-note">
          Careers-page applications auto-import on submission (Agent 4). This row is read-only — the
          recruiter's action signal lives on the application's unviewed counter in the ATS module, not here.
        </p>
      )}

      <RecordSection title="Parsed fields">
        <dl className="intake-field-list">
          {parsed.headline && (
            <>
              <dt>Headline</dt>
              <dd>{parsed.headline}</dd>
            </>
          )}
          {(parsed.email || parsed.emails?.length) && (
            <>
              <dt>Email</dt>
              <dd>{parsed.email ?? parsed.emails?.join(', ')}</dd>
            </>
          )}
          {(parsed.phone || parsed.phones?.length) && (
            <>
              <dt>Phone</dt>
              <dd>{parsed.phone ?? parsed.phones?.join(', ')}</dd>
            </>
          )}
          {parsed.company && (
            <>
              <dt>Company</dt>
              <dd>{parsed.company}</dd>
            </>
          )}
          {parsed.title && (
            <>
              <dt>Title</dt>
              <dd>{parsed.title}</dd>
            </>
          )}
          {(item.linkedin_url || parsed.linkedin_url) && (
            <>
              <dt>LinkedIn</dt>
              <dd>
                <a href={item.linkedin_url ?? parsed.linkedin_url} target="_blank" rel="noreferrer">
                  {item.linkedin_url ?? parsed.linkedin_url}
                </a>
              </dd>
            </>
          )}
        </dl>
        <button type="button" className="intake-raw-toggle" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide raw payload' : 'Show raw payload'}
        </button>
        {showRaw && <pre className="intake-raw-payload">{JSON.stringify(item.raw_payload, null, 2)}</pre>}
      </RecordSection>

      {dedup !== undefined && !isReadOnly(item) && item.status !== 'imported' && (
        <RecordSection title="Dedup check">
          {dedup ? (
            <div className="intake-dedup-match">
              <p>
                Matches an existing person: <strong>{dedup.name}</strong>
                {dedup.headline ? ` — ${dedup.headline}` : ''}
              </p>
              <p className="text-secondary">
                Existing profiles: {dedup.hasCandidateProfile ? 'candidate' : null}
                {dedup.hasCandidateProfile && dedup.hasContactProfile ? ', ' : ''}
                {dedup.hasContactProfile ? 'contact' : null}
                {!dedup.hasCandidateProfile && !dedup.hasContactProfile ? 'none yet' : ''}
              </p>
              <div className="intake-dedup-choice">
                <label>
                  <input
                    type="radio"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                  />{' '}
                  Merge into existing person
                </label>
                <label>
                  <input type="radio" checked={mode === 'new'} onChange={() => setMode('new')} />{' '}
                  Import as new (logs an override)
                </label>
              </div>
            </div>
          ) : (
            <p className="text-secondary">No match found by email or LinkedIn URL.</p>
          )}
        </RecordSection>
      )}

      {item.target_type === 'candidate' && !isReadOnly(item) && item.status !== 'imported' && (
        <RecordSection title={`Grading${needsGrading ? ' (required before import)' : ' (optional)'}`}>
          <StarGrade value={grade} size={18} onChange={setGrade} />
          <Input
            label="Grade comment"
            value={gradeComment}
            onChange={(e) => setGradeComment(e.target.value)}
            placeholder="John's grading style — a short read on fit and current situation"
            required={grade != null}
          />
          {!alreadyGraded && (
            <Button size="sm" onClick={saveGrade} disabled={busy}>
              Save grade
            </Button>
          )}
        </RecordSection>
      )}

      {item.target_type === 'contact' && !isReadOnly(item) && item.status !== 'imported' && !parsed.company && (
        <RecordSection title="Company">
          <Input
            label="New company name (optional)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Leave blank to import without a company link"
          />
        </RecordSection>
      )}

      {error && <p className="field-error-text">{error}</p>}

      {!isReadOnly(item) && item.status !== 'imported' && item.status !== 'rejected' && (
        <div className="intake-drawer-actions">
          <Button
            variant="primary"
            onClick={doImport}
            disabled={busy || !canImport({ ...item, star_grade: grade })}
            title={
              needsGrading && !alreadyGraded
                ? 'Grade this candidate before importing (linkedin_url channel)'
                : undefined
            }
          >
            Import
          </Button>
          {canReject(item) && !showReject && (
            <Button variant="danger" onClick={() => setShowReject(true)} disabled={busy}>
              Reject
            </Button>
          )}
        </div>
      )}

      {showReject && (
        <div className="intake-reject-panel">
          <Input
            label="Reject reason"
            required
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="intake-drawer-actions">
            <Button variant="danger" onClick={doReject} disabled={busy}>
              Confirm reject
            </Button>
            <Button onClick={() => setShowReject(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {item.status === 'rejected' && parsedOf(item).reject_reason && (
        <p className="text-secondary">Rejected: {parsedOf(item).reject_reason}</p>
      )}
    </Drawer>
  );
}
