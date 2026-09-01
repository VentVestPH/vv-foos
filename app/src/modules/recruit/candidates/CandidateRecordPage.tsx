// Candidate record (brief instruction 7): identity + profile, unified
// timeline plus the Gate 1 nine-panel toolkit, all backed by activities /
// tasks / reminders / attachments. Changing status_id is a plain UPDATE —
// the trigger fires candidate.status_changed.
//
// Redesign (Taleo screenshots 22-26, prompt section 8.3): the former
// two-column "identity + profile / timeline + tabs" layout is now a single
// stacked column of RecordSections in Taleo order (Requisition Summary ->
// Candidate Information -> Main Status Details -> Resume and Cover Letter ->
// Resume Preview -> Attachments -> Requisition Details -> Web Links ->
// Source -> Tracking -> Contact Log -> Events -> Tasks -> Reminders ->
// History Log/Timeline). Every Gate 1 toolkit panel (ActivityPanel,
// AttachmentsPanel, EventsPanel, TasksPanel, RemindersPanel) and every real
// handler (grading, profile save, Send Email/Schedule Meeting Google
// integration, attachments, timeline) is unchanged — only which section
// wraps it moved. Source/Requisition Details/Tracking are read-only recaps
// of data already editable in Candidate Information/Main Status Details, so
// nothing is duplicated as a separate mutation path.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useRole, useSession } from '../../../auth/SessionProvider';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { Timeline } from '../../../components/ui/Timeline';
import { SidePanelTabs } from '../../../components/ui/SidePanelTabs';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { TaleoPlaceholderAction, usePlaceholder } from '../../../shell/TaleoPlaceholder';
import { PersonIcon } from '../../../shell/icons';
import { StarGrade } from '../components/StarGrade';
import { Dialog } from '../components/Dialog';
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
import {
  errMsg,
  fmtDate,
  personEducation,
  personEmails,
  personExperience,
  personName,
  personPhones,
  supabase,
  useIsMobile,
  useLookups,
  type Application,
  type CandidateProfile,
  type Person,
  type Requisition,
} from '../lib/data';
import { sendEmail, scheduleMeeting } from '../../../lib/googleActions';

interface ProfileDraft {
  status_id: string;
  star_grade: number | null;
  grade_comment: string;
  current_title: string;
  current_employer: string;
  tenure_note: string;
  salary_flag: string;
  expected_salary: string;
  current_salary: string;
  salary_currency: string;
  initial_date: string;
  source_id: string;
  referred_by: string;
  sourcer_id: string;
  do_not_contact: boolean;
}

function toDraft(p: CandidateProfile): ProfileDraft {
  return {
    status_id: p.status_id ?? '',
    star_grade: p.star_grade,
    grade_comment: p.grade_comment ?? '',
    current_title: p.current_title ?? '',
    current_employer: p.current_employer ?? '',
    tenure_note: p.tenure_note ?? '',
    salary_flag: p.salary_flag ?? '',
    expected_salary: p.expected_salary != null ? String(p.expected_salary) : '',
    current_salary: p.current_salary != null ? String(p.current_salary) : '',
    salary_currency: p.salary_currency ?? '',
    initial_date: p.initial_date ?? '',
    source_id: p.source_id ?? '',
    referred_by: p.referred_by ?? '',
    sourcer_id: p.sourcer_id ?? '',
    do_not_contact: p.do_not_contact,
  };
}

export function CandidateRecordPage() {
  const { id } = useParams();
  const personId = id ?? '';
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const role = useRole();
  const { staff } = useSession();
  const mobile = useIsMobile();
  const lookups = useLookups();
  const { record } = useRecentlyViewed();
  const { show } = usePlaceholder();
  const profileSectionRef = useRef<HTMLDivElement>(null);

  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Send email / schedule meeting (Agent 6). Both call the connected staff
  // user's own Google account via gmail-send / calendar-create-meeting;
  // errors (not connected, scope not granted) surface inline rather than
  // failing silently.
  const [showSendEmail, setShowSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [showSchedule, setShowSchedule] = useState(false);
  const [meetingSubject, setMeetingSubject] = useState('');
  const [meetingWhen, setMeetingWhen] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('30');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const engagement = useEngagement('person', personId);

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
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Recently Viewed rail entry on visit.
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

  // Arriving from a pipeline marks the application viewed (unviewed tracking).
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

  const canEditProfile =
    !mobile && (role === 'admin' || role === 'recruiter');
  const canGrade =
    !mobile &&
    (role === 'admin' ||
      role === 'recruiter' ||
      (role === 'sourcer' && staff != null && profile?.sourcer_id === staff.id));

  const saveProfile = useCallback(async () => {
    if (!profile || !draft) return;
    // Sourcers may only write the grade fields (RLS enforces the rest).
    const patch = canEditProfile
      ? {
          status_id: draft.status_id || null,
          star_grade: draft.star_grade,
          grade_comment: draft.grade_comment.trim() || null,
          current_title: draft.current_title.trim() || null,
          current_employer: draft.current_employer.trim() || null,
          tenure_note: draft.tenure_note.trim() || null,
          salary_flag: draft.salary_flag.trim() || null,
          expected_salary: draft.expected_salary.trim()
            ? Number(draft.expected_salary)
            : null,
          current_salary: draft.current_salary.trim()
            ? Number(draft.current_salary)
            : null,
          salary_currency: draft.salary_currency.trim() || null,
          initial_date: draft.initial_date || null,
          source_id: draft.source_id || null,
          referred_by: draft.referred_by.trim() || null,
          sourcer_id: draft.sourcer_id || null,
          do_not_contact: draft.do_not_contact,
        }
      : {
          star_grade: draft.star_grade,
          grade_comment: draft.grade_comment.trim() || null,
        };
    const { error: err } = await supabase
      .from('candidate_profiles')
      .update(patch)
      .eq('person_id', profile.person_id);
    if (err) {
      setError(err.message);
    } else {
      setError(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
      await load();
    }
  }, [profile, draft, canEditProfile, load]);

  const openSendEmail = () => {
    const primary = personEmails(person as Person)[0]?.address ?? '';
    setEmailTo(primary);
    setEmailSubject('');
    setEmailBody('');
    setEmailError(null);
    setShowSendEmail(true);
  };

  const submitSendEmail = async () => {
    if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) {
      setEmailError('To, subject, and message are all required.');
      return;
    }
    setEmailBusy(true);
    setEmailError(null);
    const { error: err } = await sendEmail({
      personId,
      to: emailTo.trim(),
      subject: emailSubject.trim(),
      bodyText: emailBody.trim(),
    });
    setEmailBusy(false);
    if (err) {
      setEmailError(err);
      return;
    }
    setShowSendEmail(false);
    await engagement.refresh();
  };

  const openSchedule = () => {
    setMeetingSubject(`Screen: ${personName(person as Person)}`);
    setMeetingWhen('');
    setMeetingDuration('30');
    setMeetingError(null);
    setMeetingLink(null);
    setShowSchedule(true);
  };

  const submitSchedule = async () => {
    const attendee = personEmails(person as Person)[0]?.address;
    if (!attendee) {
      setMeetingError('This person has no email on file to invite.');
      return;
    }
    if (!meetingSubject.trim() || !meetingWhen) {
      setMeetingError('Subject and date/time are required.');
      return;
    }
    setMeetingBusy(true);
    setMeetingError(null);
    const { data, error: err } = await scheduleMeeting({
      personId,
      attendeeEmails: [attendee],
      subject: meetingSubject.trim(),
      startIso: new Date(meetingWhen).toISOString(),
      durationMinutes: Number(meetingDuration) || 30,
    });
    setMeetingBusy(false);
    if (err) {
      setMeetingError(err);
      return;
    }
    setMeetingLink(data?.meetLink ?? null);
    await engagement.refresh();
  };

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
  // Logged meetings with no invited attendees are plain contact-log entries,
  // not calendar Events (redesign section order: Contact Log vs. Events).
  const plainMeetings = meetings.filter((a) => !events.includes(a));
  const emails = activities.filter((a) => a.kind === 'email');
  const files = engagement.attachments;
  const resumes = files.filter((a) => a.kind === 'resume');
  const allowCreate = !mobile;
  const dnc = profile?.do_not_contact ?? false;

  const viewResume = async () => {
    const newest = resumes[0];
    if (!newest) return;
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
        disabled={dnc || personEmails(person).length === 0}
        title={emailDisabledTitle}
        onClick={openSendEmail}
      >
        Send Email
      </Button>
      <Button
        size="sm"
        disabled={dnc || personEmails(person).length === 0}
        title={emailDisabledTitle}
        onClick={openSchedule}
      >
        Schedule meeting
      </Button>
      {resumes.length > 0 ? (
        <Button size="sm" onClick={() => void viewResume()}>
          View Resume
        </Button>
      ) : (
        /* FOOS-TBD: no resume on file — nothing to view. */
        <TaleoPlaceholderAction
          label="View Resume"
          size="sm"
          detail="No resume is on file for this candidate yet."
        />
      )}
      {/* FOOS-TBD: no printable-resume rendering exists yet. */}
      <TaleoPlaceholderAction label="Print Resume" size="sm" />
      {/* FOOS-TBD: no "submit to requisition" workflow exists on the
          candidate record yet — candidates are linked to requisitions via
          the requisition's own Next Steps / Add candidate flow. */}
      <TaleoPlaceholderAction label="Submit" size="sm" />
      {/* FOOS-TBD: no additional record-level actions implemented yet. */}
      <TaleoPlaceholderAction label="More" size="sm" caret />
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
          {/* FOOS-TBD: no flag concept exists on candidate_profiles/people yet. */}
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
            className="link-btn taleo-back-to-list"
            onClick={() => navigate('/recruit/candidates')}
          >
            Back To List
          </button>
          <span className="text-secondary">|</span>
          {/* FOOS-TBD: no prev/next paging within the current list view is
              implemented yet. */}
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
            <dd>{person.first_name || '—'}</dd>
          </div>
          {person.middle_name && (
            <div className="info-item">
              <dt>Middle</dt>
              <dd>{person.middle_name}</dd>
            </div>
          )}
          <div className="info-item">
            <dt>Last name</dt>
            <dd>{person.last_name || '—'}</dd>
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
        </dl>

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
                    .join(' · ') || '—'}
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

      {/* Resume and Cover Letter — Taleo's literal fields here are links
          (LinkedIn Public/Recruiter, Online Resume, ZI/Twitter), not a file
          upload panel. File upload lives in Attachments below. */}
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
              <p className="text-secondary">No links on file.</p>
            )}
        </dl>
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

      <div className="record-action-bar taleo-record-bottom-bar">{actionBarContent}</div>

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

      <RecordSection title="History Log / Timeline">
        <Timeline items={timelineItems} />
      </RecordSection>

      {engagement.error && <p className="rq-error">{engagement.error}</p>}

      {showSendEmail && (
        <Dialog
          title="Send email"
          onClose={() => setShowSendEmail(false)}
          footer={
            <>
              <Button onClick={() => setShowSendEmail(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void submitSendEmail()} disabled={emailBusy}>
                {emailBusy ? 'Sending…' : 'Send'}
              </Button>
            </>
          }
        >
          <Input label="To" value={emailTo} onChange={(e) => setEmailTo(e.target.value)} />
          <Input
            label="Subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            autoFocus
          />
          <div className="field">
            <span className="field-label">Message</span>
            <textarea
              className="rq-textarea"
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </div>
          <p className="text-secondary">
            Sends through your own connected Gmail account — appears in your Sent folder.
          </p>
          {emailError && <span className="field-error-text">{emailError}</span>}
        </Dialog>
      )}

      {showSchedule && (
        <Dialog
          title="Schedule meeting"
          onClose={() => setShowSchedule(false)}
          footer={
            !meetingLink ? (
              <>
                <Button onClick={() => setShowSchedule(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => void submitSchedule()} disabled={meetingBusy}>
                  {meetingBusy ? 'Creating…' : 'Create meeting'}
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={() => setShowSchedule(false)}>
                Done
              </Button>
            )
          }
        >
          {meetingLink ? (
            <p>
              Meeting created.{' '}
              <a href={meetingLink} target="_blank" rel="noreferrer">
                Join with Google Meet
              </a>
            </p>
          ) : (
            <>
              <Input
                label="Subject"
                value={meetingSubject}
                onChange={(e) => setMeetingSubject(e.target.value)}
                autoFocus
              />
              <Input
                label="Date and time"
                type="datetime-local"
                value={meetingWhen}
                onChange={(e) => setMeetingWhen(e.target.value)}
              />
              <Input
                label="Duration (minutes)"
                type="number"
                value={meetingDuration}
                onChange={(e) => setMeetingDuration(e.target.value)}
              />
              <p className="text-secondary">
                Creates a real Calendar event with a Google Meet link, inviting{' '}
                {personEmails(person)[0]?.address ?? 'this person'}.
              </p>
              {meetingError && <span className="field-error-text">{meetingError}</span>}
            </>
          )}
        </Dialog>
      )}
    </RecordPage>
  );
}
