import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBackToList } from '../../../lib/listReturn';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { StatusHistory } from '../../../components/ui/StatusHistory';
import { Timeline } from '../../../components/ui/Timeline';
import { SidePanelTabs } from '../../../components/ui/SidePanelTabs';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { PlaceholderAction, usePlaceholder } from '../../../shell/Placeholder';
import {
  CircleArrowUp,
  User as PersonIcon,
} from 'lucide-react';
import { StarGrade } from '../../../components/ui/StarGrade';
import {
  ActivityPanel,
  attachmentUrl,
  AttachmentsPanel,
  EventsPanel,
  RemindersPanel,
  ResumePreview,
  TasksPanel,
  useEngagement,
} from '../components/engagement';
import { supabase } from '../../../lib/supabase';
import { type Application, type CandidateProfile, type Person, type Requisition, errMsg, fmtDate, personEducation, personEmails, personExperience, personName, personPhones } from '../lib';
import { useIsMobile, useLookups } from '../hooks';
import { EMPTY_CELL } from '../../../lib/format';
import { isPendingFile, PENDING_FILE_LABEL, PENDING_FILE_REASON } from '../../../lib/attachments';
import { CandidateEraseDialog } from './CandidateEraseDialog';
import { CandidateMergeDialog } from './CandidateMergeDialog';
import { CandidateOutreachDialogs } from './CandidateOutreachDialogs';
import { useCandidateOutreach } from './useCandidateOutreach';
import { toDraft, useCandidateProfileDraft } from './useCandidateProfileDraft';

export function CandidateRecordPage() {
  const backToList = useBackToList('/recruit/candidates');
  const navigate = useNavigate();
  const { id } = useParams();
  const personId = id ?? '';
  const [params] = useSearchParams();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const { record } = useRecentlyViewed();
  const { show } = usePlaceholder();
  const profileSectionRef = useRef<HTMLDivElement>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [error, setError] = useState<string | null>(null);

  const engagement = useEngagement('person', personId);
  const viewedApplicationId = params.get('application');
  const applicationEngagement = useEngagement('application', viewedApplicationId ?? '');
  const outreach = useCandidateOutreach(personId, person, engagement.refresh);
  const [merging, setMerging] = useState(false);
  const [erasing, setErasing] = useState(false);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const reload = useCallback(() => loadRef.current(), []);
  const { draft, setDraft, canEditProfile, canGrade, saved, saveProfile } =
    useCandidateProfileDraft({ profile, role, staff, mobile, onSaved: reload, onError: setError });

  const load = useCallback(async () => {
    try {
      const [p, prof, a] = await Promise.all([
        supabase.from('people').select('*').eq('id', personId).maybeSingle(),
        supabase
          .from('candidate_profiles')
          .select('*')
          .eq('person_id', personId)
          .maybeSingle(),
        supabase.from('applications').select('*').eq('person_id', personId),
      ]);
      const firstError = p.error ?? prof.error ?? a.error ?? null;
      if (firstError) throw new Error(firstError.message);
      setPerson(p.data ?? null);
      setProfile(prof.data ?? null);
      setDraft(prof.data ? toDraft(prof.data) : null);
      const appRows = a.data ?? [];
      setApps(appRows);
      if (appRows.length > 0) {
        const { data: reqRows, error: reqErr } = await supabase
          .from('requisitions')
          .select('*')
          .in('id', [...new Set(appRows.map((x) => x.requisition_id))]);
        if (reqErr) throw new Error(reqErr.message);
        setReqs(reqRows ?? []);
      } else {
        setReqs([]);
      }
    } catch (e) {
      setError(errMsg(e));
    }
  }, [personId, setDraft]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (person) {
      record({
        type: 'candidate',
        id: person.id,
        label: personName(person),
        href: `/recruit/candidates/${person.id}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.id]);

  useEffect(() => {
    const applicationId = params.get('application');
    if (!applicationId || !staff) return;
    void supabase.from('application_views').upsert(
      {
        application_id: applicationId,
        staff_id: staff.id,
        last_viewed_at: new Date().toISOString(),
      },
      { onConflict: 'application_id,staff_id' },
    );
  }, [params, staff]);



  loadRef.current = load;

  const staffName = useMemo(
    () => new Map(lookups.staff.map((s) => [s.id, s.full_name])),
    [lookups.staff],
  );
  const reqById = useMemo(() => new Map(reqs.map((r) => [r.id, r])), [reqs]);

  const scrollToProfile = useCallback(() => {
    profileSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (!person) {
    return error ? (
      <p className="rq-error">{error}</p>
    ) : (
      <p className="text-secondary">Loading…</p>
    );
  }

  const activities = engagement.activities;
  const notes = activities.filter((a) => a.kind === 'note');
  const calls = activities.filter((a) => a.kind === 'call');
  const meetings = activities.filter((a) => a.kind === 'meeting');
  const events = meetings.filter(
    (a) => Array.isArray(a.attendees) && (a.attendees as unknown[]).length > 0,
  );

  const plainMeetings = meetings.filter((a) => !events.includes(a));
  const emails = activities.filter((a) => a.kind === 'email');
  const files = engagement.attachments;
  const resumes = files.filter((a) => a.kind === 'resume');
  const allowCreate = !mobile;
  const dnc = profile?.do_not_contact ?? false;

  const viewResume = async () => {
    const newest = resumes[0];
    if (!newest) return;
    if (isPendingFile(newest.storage_path)) {
      setError(`${PENDING_FILE_LABEL}. ${PENDING_FILE_REASON}`);
      return;
    }
    const url = await attachmentUrl(newest.storage_path);
    if (url) window.open(url, '_blank', 'noopener');
    else setError('Could not create a download link for this resume.');
  };

  const timelineItems = activities.map((a) => ({
    id: a.id,
    kind: a.kind,
    subject: a.subject,
    body: a.body,
    occurred_at: a.occurred_at,
    meta: a.created_by ? staffName.get(a.created_by) : undefined,
  }));

  const statusOptions = lookups.statuses
    .filter((s) => s.is_active || s.id === draft?.status_id)
    .map((s) => ({ value: s.id, label: s.label }));

  const emailDisabledTitle = dnc
    ? 'Blocked: this person is flagged do not contact'
    : personEmails(person).length === 0
      ? 'No email on file for this person'
      : undefined;

  const actionBarContent = (
    <>
      <Button
        size="sm"
        disabled={!canEditProfile}
        title={!canEditProfile ? 'You do not have edit rights for this candidate' : undefined}
        onClick={scrollToProfile}
      >
        Edit
      </Button>
      <Button
        size="sm"
        disabled={!canEditProfile}
        title={
          canEditProfile
            ? 'Merge another candidate record into this one'
            : 'Only an admin or a recruiter can merge candidates'
        }
        onClick={() => setMerging(true)}
      >
        Merge duplicate…
      </Button>
      {role === 'admin' && (
        <Button
          size="sm"
          variant="danger"
          title="Erase this candidate and everything attached to them"
          onClick={() => setErasing(true)}
        >
          Erase…
        </Button>
      )}
      <Button
        size="sm"
        disabled={dnc || personEmails(person).length === 0}
        title={emailDisabledTitle}
        onClick={outreach.openSendEmail}
      >
        Send Email
      </Button>
      <Button
        size="sm"
        disabled={dnc || personEmails(person).length === 0}
        title={emailDisabledTitle}
        onClick={outreach.openSchedule}
      >
        Schedule meeting
      </Button>
      {resumes.length > 0 ? (
        <Button size="sm" onClick={() => void viewResume()}>
          View Resume
        </Button>
      ) : (

        <PlaceholderAction
          label="View Resume"
          size="sm"
          detail="No resume is on file for this candidate yet."
        />
      )}
      <PlaceholderAction label="Print Resume" size="sm" />
      <PlaceholderAction label="Submit" size="sm" />
      <PlaceholderAction label="More" size="sm" caret />
      {canGrade && draft && (
        <Button size="sm" variant="primary" onClick={() => void saveProfile()}>
          Save profile
        </Button>
      )}
      {saved && <span className="text-secondary">Saved.</span>}
    </>
  );

  return (
    <RecordPage
      title={personName(person)}
      icon={<PersonIcon size={40} />}
      titleExtras={
        <>
          {profile?.star_grade != null && <StarGrade value={profile.star_grade} />}
          {person.is_test && <Badge tone="outline">Test data</Badge>}
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              show('Flag', 'Flagging candidates is not implemented in the FOOS MVP yet.')
            }
          >
            Flag
          </button>
          <button
            type="button"
            className="link-btn fo-back-to-list"
            onClick={backToList}
          >
            <CircleArrowUp size={20} aria-hidden="true" />
            Back To List
          </button>
          <span className="text-secondary">|</span>
          <button
            type="button"
            className="link-btn"
            onClick={() =>
              show(
                'Next',
                'Paging to the next candidate in the current list view is not implemented yet.',
              )
            }
          >
            Next
          </button>
        </>
      }
      actionBar={actionBarContent}
    >
      {dnc && (
        <div className="dnc-banner" role="alert">
          Do not contact — outreach to this person is blocked.
        </div>
      )}
      {error && <p className="rq-error">{error}</p>}

      <RecordSection title="Requisition Summary">
        {apps.length === 0 && (
          <p className="text-secondary">No applications yet.</p>
        )}
        {apps.map((a) => {
          const r = reqById.get(a.requisition_id);
          return (
            <div key={a.id} className="approver-line">
              <Link to={`/recruit/requisitions/${a.requisition_id}`}>
                {r ? `${r.display_code} ${r.title}` : a.requisition_id}
              </Link>
              <StatusBadge status={a.stage} />
              {a.rank != null && <span className="text-secondary">Rank #{a.rank}</span>}
              {a.is_shortlisted && <Badge tone="warning">Shortlisted</Badge>}
            </div>
          );
        })}
      </RecordSection>

      <RecordSection title="Candidate Information">
        <dl className="info-grid">
          <div className="info-item">
            <dt>First name</dt>
            <dd>{person.first_name || EMPTY_CELL}</dd>
          </div>
          {person.middle_name && (
            <div className="info-item">
              <dt>Middle</dt>
              <dd>{person.middle_name}</dd>
            </div>
          )}
          <div className="info-item">
            <dt>Last name</dt>
            <dd>{person.last_name || EMPTY_CELL}</dd>
          </div>
          {person.headline && (
            <div className="info-item">
              <dt>Headline</dt>
              <dd>{person.headline}</dd>
            </div>
          )}
          {personEmails(person).map((e, i) => (
            <div className="info-item" key={`email-${i}`}>
              <dt>Email ({e.type})</dt>
              <dd>{e.address}</dd>
            </div>
          ))}
          {personPhones(person).map((p, i) => (
            <div className="info-item" key={`phone-${i}`}>
              <dt>Phone ({p.type})</dt>
              <dd>{p.number}</dd>
            </div>
          ))}
          {person.street && (
            <div className="info-item">
              <dt>Street</dt>
              <dd>{person.street}</dd>
            </div>
          )}
          {person.city && (
            <div className="info-item">
              <dt>City</dt>
              <dd>{person.city}</dd>
            </div>
          )}
          {person.state && (
            <div className="info-item">
              <dt>State/Territory</dt>
              <dd>{person.state}</dd>
            </div>
          )}
          {person.postal_code && (
            <div className="info-item">
              <dt>ZIP/Postal code</dt>
              <dd>{person.postal_code}</dd>
            </div>
          )}
          {person.country && (
            <div className="info-item">
              <dt>Country</dt>
              <dd>{person.country}</dd>
            </div>
          )}
          {person.linkedin_public_url && (
            <div className="info-item">
              <dt>LinkedIn</dt>
              <dd>
                <a
                  href={person.linkedin_public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Public profile
                </a>
              </dd>
            </div>
          )}
          {person.linkedin_recruiter_url && (
            <div className="info-item">
              <dt>LinkedIn Recruiter</dt>
              <dd>
                <a
                  href={person.linkedin_recruiter_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Recruiter profile
                </a>
              </dd>
            </div>
          )}
          {person.online_resume_url && (
            <div className="info-item">
              <dt>Online resume</dt>
              <dd>
                <a href={person.online_resume_url} target="_blank" rel="noreferrer">
                  Link
                </a>
              </dd>
            </div>
          )}

          {personEducation(person).map((ed, i) => (
            <Fragment key={`edu-${i}`}>
              {ed.bachelor_discipline && (
                <div className="info-item">
                  <dt>Bachelor Discipline{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>{ed.bachelor_discipline}</dd>
                </div>
              )}
              {ed.university && (
                <div className="info-item">
                  <dt>University{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>{ed.university}</dd>
                </div>
              )}
              {ed.year && (
                <div className="info-item">
                  <dt>Year{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>{ed.year}</dd>
                </div>
              )}
              {ed.higher_degrees && (
                <div className="info-item">
                  <dt>Higher Degrees{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>{ed.higher_degrees}</dd>
                </div>
              )}
              {ed.other_degrees && (
                <div className="info-item">
                  <dt>Other Degrees{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>{ed.other_degrees}</dd>
                </div>
              )}
            </Fragment>
          ))}

        </dl>

        <div className="info-grid info-grid-form">
          {profile && draft && (
            <>
              <Input
                label="Initial date"
                type="date"
                value={draft.initial_date}
                disabled={!canEditProfile}
                onChange={(e) => setDraft({ ...draft, initial_date: e.target.value })}
              />
              <div className="field">
                <span className="field-label">Amir Grade (star grade)</span>
                {canGrade ? (
                  <StarGrade
                    value={draft.star_grade}
                    onChange={(v) => setDraft({ ...draft, star_grade: v })}
                  />
                ) : (
                  <StarGrade value={draft.star_grade} />
                )}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="grade-comment">
                  Sourcer Grade (grade comment)
                </label>
                <textarea
                  id="grade-comment"
                  rows={3}
                  value={draft.grade_comment}
                  disabled={!canGrade}
                  onChange={(e) =>
                    setDraft({ ...draft, grade_comment: e.target.value })
                  }
                />
              </div>
              <Input
                label="Current title"
                value={draft.current_title}
                disabled={!canEditProfile}
                onChange={(e) => setDraft({ ...draft, current_title: e.target.value })}
              />
              <Input
                label="Current employer"
                value={draft.current_employer}
                disabled={!canEditProfile}
                onChange={(e) =>
                  setDraft({ ...draft, current_employer: e.target.value })
                }
              />
              <Input
                label="Tenure note"
                value={draft.tenure_note}
                disabled={!canEditProfile}
                onChange={(e) => setDraft({ ...draft, tenure_note: e.target.value })}
              />
              <Input
                label="Expected salary"
                type="number"
                value={draft.expected_salary}
                disabled={!canEditProfile}
                onChange={(e) =>
                  setDraft({ ...draft, expected_salary: e.target.value })
                }
              />
              <Input
                label="Current salary"
                type="number"
                value={draft.current_salary}
                disabled={!canEditProfile}
                onChange={(e) =>
                  setDraft({ ...draft, current_salary: e.target.value })
                }
              />
              <Input
                label="Salary currency"
                placeholder="e.g. PHP, USD"
                value={draft.salary_currency}
                disabled={!canEditProfile}
                onChange={(e) =>
                  setDraft({ ...draft, salary_currency: e.target.value })
                }
              />
              <Input
                label="Salary flag"
                value={draft.salary_flag}
                disabled={!canEditProfile}
                onChange={(e) => setDraft({ ...draft, salary_flag: e.target.value })}
              />
              <label className="rq-checkline">
                <input
                  type="checkbox"
                  checked={draft.do_not_contact}
                  disabled={!canEditProfile}
                  onChange={(e) =>
                    setDraft({ ...draft, do_not_contact: e.target.checked })
                  }
                />
                Do not contact
              </label>
            </>
          )}
        </div>

        <h2 style={{ marginTop: 'var(--sp-2)' }}>Experience</h2>
        {personExperience(person).length === 0 ? (
          <p className="text-secondary">
            No employment history on file yet — pending a fuller Zoho Experience
            Details export.
          </p>
        ) : (
          <dl className="info-grid">
            {personExperience(person).map((exp, i) => (
              <div className="info-item" key={`exp-${i}`}>
                <dt>Experience {i + 1}</dt>
                <dd>
                  {Object.entries(exp)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${String(v)}`)
                    .join(' · ') || EMPTY_CELL}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {profile?.assessment_scores &&
          Object.keys(profile.assessment_scores as Record<string, unknown>).length >
            0 && (
            <>
              <h2 style={{ marginTop: 'var(--sp-2)' }}>Assessment scores</h2>
              <dl className="info-grid">
                {Object.entries(
                  profile.assessment_scores as Record<string, unknown>,
                ).map(([k, v]) => (
                  <div className="info-item" key={k}>
                    <dt>{k.trim()}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
      </RecordSection>

      <div ref={profileSectionRef} />
      {profile && draft ? (
        <RecordSection title="Main Status Details">
          <div className="panel-stack">
            <Select
              label="Main status"
              placeholder="No status"
              options={statusOptions}
              value={draft.status_id}
              disabled={!canEditProfile}
              onChange={(e) => setDraft({ ...draft, status_id: e.target.value })}
            />
          </div>
        </RecordSection>
      ) : (
        <RecordSection title="Main Status Details">
          <p className="text-secondary">
            No candidate profile on this person yet.
          </p>
        </RecordSection>
      )}

      <RecordSection title="Resume and Cover Letter">
        <dl className="info-grid">
          {person.linkedin_public_url && (
            <div className="info-item">
              <dt>LinkedIn PUBLIC Profile</dt>
              <dd>
                <a href={person.linkedin_public_url} target="_blank" rel="noreferrer">
                  {person.linkedin_public_url}
                </a>
              </dd>
            </div>
          )}
          {person.linkedin_recruiter_url && (
            <div className="info-item">
              <dt>LinkedIn RECRUITER URL</dt>
              <dd>
                <a
                  href={person.linkedin_recruiter_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {person.linkedin_recruiter_url}
                </a>
              </dd>
            </div>
          )}
          {person.online_resume_url && (
            <div className="info-item">
              <dt>Online Resume URL</dt>
              <dd>
                <a href={person.online_resume_url} target="_blank" rel="noreferrer">
                  {person.online_resume_url}
                </a>
              </dd>
            </div>
          )}
          {Array.isArray(person.other_urls) &&
            (person.other_urls as unknown[]).map((u, i) => {
              const url = String(u);
              return (
                <div className="info-item" key={`url-${i}`}>
                  <dt>ZI/Twitter{i > 0 ? ` (${i + 1})` : ''}</dt>
                  <dd>
                    <a href={url} target="_blank" rel="noreferrer">
                      {url}
                    </a>
                  </dd>
                </div>
              );
            })}
          {!person.linkedin_public_url &&
            !person.linkedin_recruiter_url &&
            !person.online_resume_url &&
            (!Array.isArray(person.other_urls) || person.other_urls.length === 0) && (
              <div className="info-item">
                <dt>Links</dt>
                <dd className="text-secondary">No links on file.</dd>
              </div>
            )}
        </dl>
      </RecordSection>

      <RecordSection title="Resumes" defaultOpen={resumes.length > 0}>
        <AttachmentsPanel
          items={resumes}
          parent={{ type: 'person', id: person.id }}
          fixedKind="resume"
          allowUpload={allowCreate}
          onChanged={engagement.refresh}
        />
      </RecordSection>

      <RecordSection title="Resume Preview" defaultOpen={resumes.length > 0}>
        {resumes.length > 0 ? (
          <ResumePreview attachment={resumes[0]} />
        ) : (
          <p className="text-secondary">No resume on file to preview yet.</p>
        )}
      </RecordSection>

      <RecordSection title="Attachments">
        <AttachmentsPanel
          items={files}
          parent={{ type: 'person', id: person.id }}
          allowUpload={allowCreate}
          onChanged={engagement.refresh}
        />
      </RecordSection>

      {viewedApplicationId && (
        <RecordSection
          title="Application Attachments"
          defaultOpen={applicationEngagement.attachments.length > 0}
        >
          <AttachmentsPanel
            items={applicationEngagement.attachments}
            parent={{ type: 'application', id: viewedApplicationId }}
            allowUpload={allowCreate}
            onChanged={applicationEngagement.refresh}
          />
        </RecordSection>
      )}

      <div className="record-action-bar fo-record-bottom-bar">{actionBarContent}</div>

      <RecordSection title="Requisition Details" defaultOpen={false}>
        {apps.length === 0 && (
          <p className="text-secondary">No application-specific details yet.</p>
        )}
        {apps.map((a) => {
          const r = reqById.get(a.requisition_id);
          return (
            <div key={a.id} className="approver-line">
              <span className="approver-name">
                {r ? `${r.display_code} — ${r.title}` : a.requisition_id}
              </span>
              <StatusBadge status={a.stage} />
              {a.rank != null && <span className="text-secondary">Rank #{a.rank}</span>}
              {a.is_shortlisted && <Badge tone="warning">Shortlisted</Badge>}
            </div>
          );
        })}
      </RecordSection>

      <RecordSection title="Web Links" defaultOpen={false}>
        <p className="text-secondary">
          Auto-generated search links built from this candidate&rsquo;s name — not
          stored data, so nothing here can go stale.
        </p>
        <div className="approver-line">
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(personName(person))}`}
            target="_blank"
            rel="noreferrer"
          >
            Search Google for &ldquo;{personName(person)}&rdquo;
          </a>
        </div>
        <div className="approver-line">
          <a
            href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(personName(person))}`}
            target="_blank"
            rel="noreferrer"
          >
            Search LinkedIn for &ldquo;{personName(person)}&rdquo;
          </a>
        </div>
      </RecordSection>

      <RecordSection title="Source" defaultOpen={false}>
        {profile && draft ? (
          <div className="panel-stack">
            <Select
              label="Source"
              placeholder="No source"
              options={lookups.sources.map((s) => ({ value: s.id, label: s.name }))}
              value={draft.source_id}
              disabled={!canEditProfile}
              onChange={(e) => setDraft({ ...draft, source_id: e.target.value })}
            />
            <Select
              label="Sourcer"
              placeholder="No sourcer"
              options={lookups.staff.map((s) => ({ value: s.id, label: s.full_name }))}
              value={draft.sourcer_id}
              disabled={!canEditProfile}
              onChange={(e) => setDraft({ ...draft, sourcer_id: e.target.value })}
            />
            <Input
              label="Referred by"
              value={draft.referred_by}
              disabled={!canEditProfile}
              onChange={(e) => setDraft({ ...draft, referred_by: e.target.value })}
            />
          </div>
        ) : (
          <p className="text-secondary">No candidate profile on this person yet.</p>
        )}
      </RecordSection>

      <RecordSection title="Tracking" defaultOpen={false}>
        <dl className="info-grid">
          <div className="info-item">
            <dt>Candidate record last updated</dt>
            <dd>{fmtDate(person.updated_at)}</dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection title="Contact Log">
        <SidePanelTabs
          tabs={[
            {
              key: 'notes',
              label: 'Notes',
              count: notes.length,
              content: (
                <ActivityPanel
                  items={notes}
                  kind="note"
                  kindLabel="Note"
                  emptyText="No notes yet."
                  allowCreate={allowCreate}
                  onCreate={engagement.addActivity}
                />
              ),
            },
            {
              key: 'calls',
              label: 'Calls',
              count: calls.length,
              content: (
                <ActivityPanel
                  items={calls}
                  kind="call"
                  kindLabel="Call"
                  emptyText="No calls logged yet."
                  allowCreate={allowCreate}
                  onCreate={engagement.addActivity}
                />
              ),
            },
            {
              key: 'meetings',
              label: 'Meetings',
              count: plainMeetings.length,
              content: (
                <ActivityPanel
                  items={plainMeetings}
                  kind="meeting"
                  kindLabel="Meeting"
                  emptyText="No meetings yet."
                  allowCreate={allowCreate}
                  onCreate={engagement.addActivity}
                />
              ),
            },
            {
              key: 'emails',
              label: 'Emails',
              count: emails.length,
              content: (
                <ActivityPanel
                  items={emails}
                  kind="email"
                  kindLabel="Email"
                  emptyText="No linked emails yet — Gmail sync (Agent 6) matches them by participant address."
                  allowCreate={false}
                  onCreate={engagement.addActivity}
                />
              ),
            },
          ]}
        />
      </RecordSection>

      <RecordSection title="Events" defaultOpen={events.length > 0}>
        <EventsPanel items={events} />
      </RecordSection>

      <RecordSection title="Tasks">
        <TasksPanel
          items={engagement.tasks}
          allowCreate={allowCreate}
          onCreate={engagement.addTask}
          onToggle={engagement.toggleTask}
        />
      </RecordSection>

      <RecordSection title="Reminders">
        <RemindersPanel
          items={engagement.reminders}
          allowCreate={allowCreate}
          onCreate={engagement.addReminder}
          onDismiss={engagement.dismissReminder}
        />
      </RecordSection>

      <RecordSection title="Status History" defaultOpen={false}>
        <StatusHistory changes={activities.filter((a) => a.kind === 'status_change')} />
      </RecordSection>

      <RecordSection title="History Log / Timeline">
        <Timeline items={timelineItems} />
      </RecordSection>

      {engagement.error && <p className="rq-error">{engagement.error}</p>}

      <CandidateOutreachDialogs outreach={outreach} person={person} />

      {merging && (
        <CandidateMergeDialog
          survivor={person}
          onClose={() => setMerging(false)}
          onMerged={load}
        />
      )}

      {erasing && (
        <CandidateEraseDialog
          person={person}
          onClose={() => setErasing(false)}
          onErased={() => navigate('/recruit/candidates')}
        />
      )}
    </RecordPage>
  );
}
