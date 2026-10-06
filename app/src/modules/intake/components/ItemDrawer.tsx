import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RecordSection } from '../../../components/ui/RecordPage';
import { SectionSkeleton } from '../../../components/ui/RecordSkeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { Info as InfoIcon, PencilLine, Upload, UserCheck as UserCheckIcon } from 'lucide-react';
import { IntakeEditDialog } from './IntakeEditDialog';
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
  TARGET_LABEL,
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
  const [editing, setEditing] = useState(false);
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

  const checkingDedup = !isReadOnly(item) && item.status !== 'imported' && dedup === undefined;
  const showSkeleton = useMinimumVisible(checkingDedup);

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

  if (showSkeleton) {
    return (
      <Drawer title={item.full_name || 'Intake item'} onClose={onClose}>
        <SectionSkeleton label="Loading the intake item" sections={4} />
      </Drawer>
    );
  }

  return (
    <Drawer title={item.full_name || 'Intake item'} onClose={onClose}>
      <div className="intake-drawer-meta">
        <span className="badge-tone">{CHANNEL_LABEL[item.channel]}</span>
        <span className="badge-tone">{TARGET_LABEL[item.target_type]}</span>
        <span className="badge-tone">{STATUS_LABEL[item.status]}</span>
        {item.batch_label && <span className="badge-tone">{item.batch_label}</span>}
        <Button size="sm" onClick={() => setEditing(true)}>
          <PencilLine size={20} aria-hidden="true" />
          Edit
        </Button>
      </div>
      {editing && (
        <IntakeEditDialog
          item={item}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onSaved();
          }}
        />
      )}

      {isReadOnly(item) && (
        <p className="intake-readonly-note">
          <InfoIcon size={20} aria-hidden="true" />
          <span>
            Careers-page applications import themselves on submission, so this row is read-only. The
            signal a recruiter acts on is the application's unviewed counter in the ATS, not this queue.
          </span>
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
        <button type="button" className="link-btn" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? 'Hide raw payload' : 'Show raw payload'}
        </button>
        {showRaw && <pre className="intake-raw-payload intake-inline-panel">{JSON.stringify(item.raw_payload, null, 2)}</pre>}
      </RecordSection>

      {!isReadOnly(item) && item.status !== 'imported' && (
        <RecordSection title="Possible duplicates">
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
              <div
                className="intake-dedup-choice"
                role="radiogroup"
                aria-label="How to import this person"
              >
                <label>
                  <input
                    type="radio"
                    name="intake-dedup-mode"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                  />{' '}
                  Merge into existing person
                </label>
                <label>
                  <input
                    type="radio"
                    name="intake-dedup-mode"
                    checked={mode === 'new'}
                    onChange={() => setMode('new')}
                  />{' '}
                  Import as new (logs an override)
                </label>
              </div>
            </div>
          ) : (
            <EmptyState
              compact
              icon={<UserCheckIcon size={32} />}
              title="No existing person matches"
              hint="Nothing shares this email or LinkedIn URL, so importing creates a new record."
            />
          )}
        </RecordSection>
      )}

      {item.target_type === 'candidate' && !isReadOnly(item) && item.status !== 'imported' && (
        <RecordSection title={`Grading${needsGrading ? ' (required before import)' : ' (optional)'}`}>
          <StarGrade value={grade} size={20} onChange={setGrade} />
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

      {error && <p className="field-error-text" role="alert">{error}</p>}

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
            <Upload size={20} aria-hidden="true" />
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
        <div className="intake-reject-panel intake-inline-panel">
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
