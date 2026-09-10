import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useListReturnHref, useRecordSiblings } from '../../../lib/listReturn';
import { candidateNeighbours, type CandidateNeighbours } from './candidateSiblings';
import { RecordPager } from '../../../components/ui/RecordPager';
import { SectionSettingsDialog } from '../../../components/ui/SectionSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { useSectionPrefs } from '../../../hooks/useSectionPrefs';

const CAND_SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  'Requisition Summary': false,
  'Candidate Information': true,
  'Main Status Details': true,
  'Resume and Cover Letter': true,
  Resumes: false,
  Attachments: false,
  'Web Links': false,
  Source: false,
  Tracking: false,
  'Contact Log': false,
  Events: false,
  Tasks: true,
  Reminders: true,
  'Status History': false,
  'History Log / Timeline': false,
};

const CAND_RECORD_SECTIONS = Object.keys(CAND_SECTION_DEFAULT_OPEN);
import { useRole, useSession } from '../../../auth/SessionProvider';
import { ActionMenu, type ActionMenuItem } from '../../../components/ui/ActionMenu';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { DateField } from '../../../components/ui/DateField';
import { Select } from '../../../components/ui/Select';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { InfoGroup } from '../../../components/ui/InfoGroup';
import { EmptyState } from '../../../components/ui/EmptyState';
import { StatusHistory } from '../../../components/ui/StatusHistory';
import { Timeline } from '../../../components/ui/Timeline';
import { SidePanelTabs } from '../../../components/ui/SidePanelTabs';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { PlaceholderAction, usePlaceholder } from '../../../shell/Placeholder';
import {
  Briefcase as BriefcaseIcon,
  ExternalLink as ExternalLinkIcon,
  Flag as FlagIcon,
  Globe as GlobeIcon,
  Link2 as LinkIcon,
  Search as SearchIcon,
  User as PersonIcon,
} from 'lucide-react';
import { StarGrade } from '../../../components/ui/StarGrade';
import {
  ActivityPanel,
  attachmentUrl,
  AttachmentsPanel,
  EventsPanel,
  RemindersPanel,
  TasksPanel,
  useEngagement,
} from '../components/engagement';
import { CURRENCIES, linkHost } from '../../../lib/format';
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
  const listHref = useListReturnHref('/recruit/candidates');
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
  const siblings = useRecordSiblings('/recruit/candidates', personId);
  const prefs = useSectionPrefs('recruit.candidate.record');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const opensOnLoad = (section: string) =>
    prefs.opensOnLoad(section, CAND_SECTION_DEFAULT_OPEN[section] ?? true);
  const [byName, setByName] = useState<CandidateNeighbours>({
    previousId: null,
    nextId: null,
  });

  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const engagement = useEngagement('person', personId);
  const viewedApplicationId = params.get('application');
  const applicationEngagement = useEngagement('application', viewedApplicationId ?? '');
  const outreach = useCandidateOutreach(personId, person, engagement.refresh);

  const [merging, setMerging] = useState(false);
  const [erasing, setErasing] = useState(false);
  const loadRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const reload = useCallback(() => loadRef.current(), []);
  const [flagBusy, setFlagBusy] = useState(false);
  const toggleDoNotContact = useCallback(async () => {
    if (!profile) return;
    setFlagBusy(true);
    const { error: err } = await supabase
      .from('candidate_profiles')
      .update({ do_not_contact: !profile.do_not_contact })
      .eq('person_id', profile.person_id);
    setFlagBusy(false);
    if (err) setError(err.message);
    else reload();
  }, [profile, reload]);
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
    } finally {
      setLoaded(true);
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

  useEffect(() => {
    if (siblings.total > 0 || !person) {
      setByName({ previousId: null, nextId: null });
      return;
    }
    let live = true;
    void candidateNeighbours({ last_name: person.last_name, person_id: person.id }).then(
      (found) => {
        if (live) setByName(found);
      },
    );
    return () => {
      live = false;
    };
  }, [siblings.total, person]);

  const previousId = siblings.previousId ?? byName.previousId;
  const nextId = siblings.nextId ?? byName.nextId;

  const startEditing = useCallback(() => {
    const section = document.getElementById('candidate-information');
    if (!section) return;
    const header = section.querySelector<HTMLButtonElement>('.record-section-header');
    if (header?.getAttribute('aria-expanded') === 'false') header.click();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const first = section.querySelector<HTMLElement>(
          '.info-form-grid input:not([disabled]), .info-form-grid textarea:not([disabled])',
        );
        if (first) first.focus();
        else section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  if (!person) {
    if (error) {
      return <p className="form-error" role="alert">{error}</p>;
    }
    if (loaded) {
      return (
        <div className="stub-panel">
          <h1>Candidate not found</h1>
          <p>This record does not exist, or your role does not have access to it.</p>
        </div>
      );
    }
    return <p className="text-secondary">Loading…</p>;
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

  const seenTimelineKeys = new Set<string>();
  const timelineItems = activities
    .filter((a) => {
      const key = [
        a.kind,
        a.subject,
        a.body,
        a.occurred_at.slice(0, 16),
        a.created_by,
      ].join('\u0000');
      if (seenTimelineKeys.has(key)) return false;
      seenTimelineKeys.add(key);
      return true;
    })
    .map((a) => ({
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

  const overflowItems: ActionMenuItem[] = [
    {
      label: 'Schedule meeting',
      onSelect: outreach.openSchedule,
      disabled: dnc || personEmails(person).length === 0,
      ...(emailDisabledTitle ? { title: emailDisabledTitle } : {}),
    },
    { label: 'Print Resume', onSelect: () => show('Print Resume') },
    { label: 'Submit', onSelect: () => show('Submit') },
    {
      label: 'Merge duplicate…',
      onSelect: () => setMerging(true),
      disabled: !canEditProfile,
      title: canEditProfile
        ? 'Merge another candidate record into this one'
        : 'Only an admin or a recruiter can merge candidates',
    },
    ...(role === 'admin'
      ? [
          {
            label: 'Erase…',
            onSelect: () => setErasing(true),
            destructive: true,
            title: 'Erase this candidate and everything attached to them',
          },
        ]
      : []),
  ];

  const actionBarContent = (
    <>
      {canGrade && draft && (
        <Button size="sm" variant="primary" onClick={() => void saveProfile()}>
          Save profile
        </Button>
      )}
      <Button
        size="sm"
        disabled={!canEditProfile}
        title={
          canEditProfile
            ? 'Open Candidate Information and start editing'
            : 'You do not have edit rights for this candidate'
        }
        onClick={startEditing}
      >
        Edit
      </Button>
      <Button
        size="sm"
        disabled={dnc || personEmails(person).length === 0}
        title={emailDisabledTitle}
        onClick={outreach.openSendEmail}
      >
        Send Email
      </Button>
      {resumes.length > 0 ? (
        <Button size="sm" onClick={() => void viewResume()}>
          View Resume
        </Button>
      ) : (
        <PlaceholderAction
          label="View Resume"
          size="sm"
          detail="Upload a resume in the Attachments section and it will open from here."
        />
      )}
      <ActionMenu label="More actions" items={overflowItems} iconOnly />
      {saved && <span className="text-secondary">Saved.</span>}
    </>
  );

  return (
    <RecordPage
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Candidates', to: listHref },
        { label: personName(person) },
      ]}
      title={personName(person)}
      icon={<PersonIcon size={32} />}
      headerActions={
        <SettingsButton
          label="Section settings"
          title="Choose which sections appear"
          onClick={() => setSettingsOpen(true)}
        />
      }
      titleExtras={
        <>
          {draft ? (
            <span className="cand-header-grade">
              {canGrade ? (
                <StarGrade
                  value={draft.star_grade}
                  subject={personName(person)}
                  onChange={(v) => setDraft({ ...draft, star_grade: v })}
                />
              ) : (
                <StarGrade value={draft.star_grade} subject={personName(person)} />
              )}
            </span>
          ) : (
            profile?.star_grade != null && <StarGrade value={profile.star_grade} />
          )}
          {person.is_test && <Badge tone="outline">Test record</Badge>}
          <button
            type="button"
            className="cand-flag-toggle"
            data-on={dnc ? 'true' : 'false'}
            aria-pressed={dnc}
            disabled={!canEditProfile || flagBusy}
            title={
              !canEditProfile
                ? 'Only an admin or a recruiter can change this flag'
                : dnc
                  ? 'Flagged do not contact. Click to clear it.'
                  : 'Flag this candidate as do not contact'
            }
            onClick={() => void toggleDoNotContact()}
          >
            <FlagIcon size={20} aria-hidden="true" />
            <span className="visually-hidden">
              {dnc ? 'Clear the do not contact flag' : 'Flag as do not contact'}
            </span>
          </button>
          <RecordPager
            noun="candidate"
            position={siblings.position}
            total={siblings.total}
            previousId={previousId}
            nextId={nextId}
            onGo={siblings.go}
          />
        </>
      }
      actionBar={actionBarContent}
    >
      {dnc && (
        <div className="dnc-banner" role="alert">
          Do not contact — outreach to this person is blocked.
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}

      <RecordSection title="Requisition Summary" hidden={prefs.isHidden("Requisition Summary")} defaultOpen={opensOnLoad("Requisition Summary")}>
        {apps.length === 0 && (
          <EmptyState
            compact
            icon={<BriefcaseIcon size={32} />}
            title="No applications yet"
            hint="Add this candidate to a requisition and the application shows up here."
          />
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

      <RecordSection title="Candidate Information" id="candidate-information" hidden={prefs.isHidden("Candidate Information")} defaultOpen={opensOnLoad("Candidate Information")}>
        <div className="info-groups">
        <InfoGroup label="Name">
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
          </dl>
        </InfoGroup>

        <InfoGroup label="Contact">
          {personEmails(person).length === 0 && personPhones(person).length === 0 ? (
            <p className="info-group-hint">No email or phone on file.</p>
          ) : (
            <dl className="info-grid">
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
            </dl>
          )}
        </InfoGroup>

        {(person.street ||
          person.city ||
          person.state ||
          person.postal_code ||
          person.country) && (
          <InfoGroup label="Location">
            <dl className="info-grid">
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
            </dl>
          </InfoGroup>
        )}

        {(person.linkedin_public_url ||
          person.linkedin_recruiter_url ||
          person.online_resume_url) && (
          <InfoGroup label="Profiles">
            <dl className="info-grid">
              {person.linkedin_public_url && (
                <div className="info-item">
                  <dt>LinkedIn</dt>
                  <dd>
                    <a href={person.linkedin_public_url} target="_blank" rel="noreferrer">
                      Public profile
                    </a>
                  </dd>
                </div>
              )}
              {person.linkedin_recruiter_url && (
                <div className="info-item">
                  <dt>LinkedIn Recruiter</dt>
                  <dd>
                    <a href={person.linkedin_recruiter_url} target="_blank" rel="noreferrer">
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
            </dl>
          </InfoGroup>
        )}

        {personEducation(person).length > 0 && (
          <InfoGroup label="Education">
            <dl className="info-grid">
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
          </InfoGroup>
        )}

        <InfoGroup label="Experience">
          {personExperience(person).length === 0 ? (
            <p className="info-group-hint">
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
        </InfoGroup>

        {profile?.assessment_scores &&
          Object.keys(profile.assessment_scores as Record<string, unknown>).length >
            0 && (
            <InfoGroup label="Assessment scores">
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
            </InfoGroup>
          )}

        {profile && draft && (
          <InfoGroup
            label="Grading and salary"
            hint="Editable. Use Save profile in the action bar to keep these."
          >
            <div className="field cand-grade-row">
              <span className="field-label">Amir Grade (star grade)</span>
              {canGrade ? (
                <StarGrade
                  value={draft.star_grade}
                  subject={personName(person)}
                  onChange={(v) => setDraft({ ...draft, star_grade: v })}
                />
              ) : (
                <StarGrade value={draft.star_grade} subject={personName(person)} />
              )}
            </div>
            <div className="info-form-grid">
              <DateField
                label="Initial date"
                value={draft.initial_date}
                disabled={!canEditProfile}
                onChange={(e) => setDraft({ ...draft, initial_date: e.target.value })}
              />
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
              <Select
                label="Salary currency"
                placeholder="Not set"
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
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
              <div className="field field-wide">
                <label className="field-label" htmlFor="grade-comment">
                  Sourcer Grade (grade comment)
                </label>
                <textarea
                  id="grade-comment"
                  rows={4}
                  value={draft.grade_comment}
                  disabled={!canGrade}
                  onChange={(e) =>
                    setDraft({ ...draft, grade_comment: e.target.value })
                  }
                />
              </div>
              <label className="checkline field-wide">
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
            </div>
          </InfoGroup>
        )}
        </div>
      </RecordSection>

      {profile && draft ? (
        <RecordSection
          title="Main Status Details"
          id="main-status-details"
          hidden={prefs.isHidden('Main Status Details')}
          defaultOpen={opensOnLoad('Main Status Details')}
        >
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
        <RecordSection
          title="Main Status Details"
          hidden={prefs.isHidden('Main Status Details')}
          defaultOpen={opensOnLoad('Main Status Details')}
        >
          <p className="text-secondary">
            No candidate profile on this person yet.
          </p>
        </RecordSection>
      )}

      <RecordSection title="Resume and Cover Letter" hidden={prefs.isHidden("Resume and Cover Letter")} defaultOpen={opensOnLoad("Resume and Cover Letter")}>
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

      <RecordSection title="Resumes" count={resumes.length} empty={resumes.length === 0} hidden={prefs.isHidden("Resumes")} defaultOpen={opensOnLoad("Resumes")}>
        <AttachmentsPanel
          items={resumes}
          parent={{ type: 'person', id: person.id }}
          fixedKind="resume"
          allowUpload={allowCreate}
          onChanged={engagement.refresh}
        />
      </RecordSection>

      <RecordSection title="Attachments" count={files.length} empty={files.length === 0} hidden={prefs.isHidden("Attachments")} defaultOpen={opensOnLoad("Attachments")}>
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


      <RecordSection title="Web Links" hidden={prefs.isHidden("Web Links")} defaultOpen={opensOnLoad("Web Links")}>
        <p className="info-group-hint">
          Search links are built from this candidate&rsquo;s name, so nothing here can
          go stale. Google and LinkedIn both refuse to be framed, so each opens in a
          new tab.
        </p>
        <ul className="fo-link-cards">
          <li>
            <a
              className="fo-link-card"
              href={`https://www.google.com/search?q=${encodeURIComponent(personName(person))}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="fo-link-card-icon" aria-hidden="true">
                <SearchIcon size={20} />
              </span>
              <span className="fo-link-card-text">
                <span className="fo-link-card-title">
                  Search Google for &ldquo;{personName(person)}&rdquo;
                </span>
                <span className="fo-link-card-meta">google.com</span>
              </span>
              <ExternalLinkIcon size={20} className="fo-link-card-go" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a
              className="fo-link-card"
              href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(personName(person))}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="fo-link-card-icon" aria-hidden="true">
                <SearchIcon size={20} />
              </span>
              <span className="fo-link-card-text">
                <span className="fo-link-card-title">
                  Search LinkedIn for &ldquo;{personName(person)}&rdquo;
                </span>
                <span className="fo-link-card-meta">linkedin.com</span>
              </span>
              <ExternalLinkIcon size={20} className="fo-link-card-go" aria-hidden="true" />
            </a>
          </li>
          {person.linkedin_public_url && (
            <li>
              <a
                className="fo-link-card"
                href={person.linkedin_public_url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="fo-link-card-icon" aria-hidden="true">
                  <LinkIcon size={20} />
                </span>
                <span className="fo-link-card-text">
                  <span className="fo-link-card-title">LinkedIn profile on file</span>
                  <span className="fo-link-card-meta">
                    {linkHost(person.linkedin_public_url)}
                  </span>
                </span>
                <ExternalLinkIcon size={20} className="fo-link-card-go" aria-hidden="true" />
              </a>
            </li>
          )}
          {person.linkedin_recruiter_url && (
            <li>
              <a
                className="fo-link-card"
                href={person.linkedin_recruiter_url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="fo-link-card-icon" aria-hidden="true">
                  <LinkIcon size={20} />
                </span>
                <span className="fo-link-card-text">
                  <span className="fo-link-card-title">LinkedIn Recruiter profile</span>
                  <span className="fo-link-card-meta">
                    {linkHost(person.linkedin_recruiter_url)}
                  </span>
                </span>
                <ExternalLinkIcon size={20} className="fo-link-card-go" aria-hidden="true" />
              </a>
            </li>
          )}
          {person.online_resume_url && (
            <li>
              <a
                className="fo-link-card"
                href={person.online_resume_url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="fo-link-card-icon" aria-hidden="true">
                  <GlobeIcon size={20} />
                </span>
                <span className="fo-link-card-text">
                  <span className="fo-link-card-title">Online resume</span>
                  <span className="fo-link-card-meta">
                    {linkHost(person.online_resume_url)}
                  </span>
                </span>
                <ExternalLinkIcon size={20} className="fo-link-card-go" aria-hidden="true" />
              </a>
            </li>
          )}
        </ul>
      </RecordSection>

      <RecordSection title="Source" hidden={prefs.isHidden("Source")} defaultOpen={opensOnLoad("Source")}>
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
          <EmptyState
            compact
            icon={<PersonIcon size={32} />}
            title="No candidate profile on this person yet"
            hint="Use Edit to add sourcing details, grade and referral."
          />
        )}
      </RecordSection>

      <RecordSection title="Tracking" hidden={prefs.isHidden("Tracking")} defaultOpen={opensOnLoad("Tracking")}>
        <dl className="info-grid">
          <div className="info-item">
            <dt>Candidate record last updated</dt>
            <dd>{fmtDate(person.updated_at)}</dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection title="Contact Log" hidden={prefs.isHidden("Contact Log")} defaultOpen={opensOnLoad("Contact Log")}>
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

      <RecordSection title="Events" count={events.length} empty={events.length === 0} hidden={prefs.isHidden("Events")} defaultOpen={opensOnLoad("Events")}>
        <EventsPanel items={events} />
      </RecordSection>

      <RecordSection title="Tasks" count={engagement.tasks.length} hidden={prefs.isHidden("Tasks")} defaultOpen={opensOnLoad("Tasks")}>
        <TasksPanel
          items={engagement.tasks}
          allowCreate={allowCreate}
          onCreate={engagement.addTask}
          onToggle={engagement.toggleTask}
        />
      </RecordSection>

      <RecordSection title="Reminders" count={engagement.reminders.length} hidden={prefs.isHidden("Reminders")} defaultOpen={opensOnLoad("Reminders")}>
        <RemindersPanel
          items={engagement.reminders}
          allowCreate={allowCreate}
          onCreate={engagement.addReminder}
          onDismiss={engagement.dismissReminder}
        />
      </RecordSection>

      <RecordSection
        title="Status History"
        count={activities.filter((a) => a.kind === 'status_change').length}
        empty={activities.filter((a) => a.kind === 'status_change').length === 0}
      >
        <StatusHistory changes={activities.filter((a) => a.kind === 'status_change')} />
      </RecordSection>

      <RecordSection title="History Log / Timeline" hidden={prefs.isHidden("History Log / Timeline")} defaultOpen={opensOnLoad("History Log / Timeline")}>
        <Timeline items={timelineItems} />
      </RecordSection>

      {engagement.error && <p className="form-error" role="alert">{engagement.error}</p>}

      <CandidateOutreachDialogs outreach={outreach} person={person} />

      {settingsOpen && (
        <SectionSettingsDialog
          title="Section settings"
          hint="Choose which sections appear on this candidate, and which open when the page loads. The choice is saved to your account."
          sections={CAND_RECORD_SECTIONS}
          prefs={prefs}
          defaultOpenFor={(section) => CAND_SECTION_DEFAULT_OPEN[section] ?? true}
          onClose={() => setSettingsOpen(false)}
        />
      )}

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
