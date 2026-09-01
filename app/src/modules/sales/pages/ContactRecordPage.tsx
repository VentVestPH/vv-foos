import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db as supabase } from '../db';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { Table } from '../../../components/ui/Table';
import { ContactCardIcon } from '../../../shell/icons';
import { EngagementPanel } from '../components/EngagementPanel';
import { Modal } from '../components/Modal';
import { useCanEditCrm, useCompanyOptions } from '../hooks';
import {
  emailList,
  fmtDate,
  fmtMoney,
  locationLabel,
  personName,
  phoneList,
  type ContactProfile,
  type Deal,
  type Person,
} from '../lib';
import { sendEmail, scheduleMeeting } from '../../../lib/googleActions';

export function ContactRecordPage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { record } = useRecentlyViewed();
  const { companyName, companyOptions } = useCompanyOptions();

  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editIsPrimary, setEditIsPrimary] = useState(false);
  const [editSince, setEditSince] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [showSendEmail, setShowSendEmail] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showSchedule, setShowSchedule] = useState(false);
  const [meetingSubject, setMeetingSubject] = useState('');
  const [meetingWhen, setMeetingWhen] = useState('');
  const [meetingDuration, setMeetingDuration] = useState('30');
  const [meetingBusy, setMeetingBusy] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!personId) return;
    const [personRes, profileRes, dealRes] = await Promise.all([
      supabase.from('people').select('*').eq('id', personId).maybeSingle(),
      supabase
        .from('contact_profiles')
        .select('*')
        .eq('person_id', personId)
        .maybeSingle(),
      supabase
        .from('deals')
        .select('*')
        .eq('primary_contact_id', personId)
        .order('updated_at', { ascending: false }),
    ]);
    setPerson(personRes.data ?? null);
    setProfile(profileRes.data ?? null);
    setDeals(dealRes.data ?? []);
    setLoaded(true);
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (person) {
      record({
        type: 'contact',
        id: person.id,
        label: personName(person),
        href: `/sales/contacts/${person.id}`,
      });
    }
  }, [person, record]);

  if (!personId) return null;
  if (loaded && (!person || !profile)) {
    return (
      <div className="stub-panel">
        <h1>Contact not found</h1>
        <p>
          Either the record does not exist or your role cannot view it.
        </p>
      </div>
    );
  }
  if (!person || !profile) return null;

  const openEdit = () => {
    setEditTitle(profile.title ?? '');
    setEditCompanyId(profile.company_id ?? '');
    setEditIsPrimary(profile.is_primary);
    setEditSince(profile.since_date ?? '');
    setSaveError(null);
    setEditing(true);
  };

  const saveProfile = async () => {
    const { error } = await supabase
      .from('contact_profiles')
      .update({
        title: editTitle.trim() || null,
        company_id: editCompanyId || null,
        is_primary: editIsPrimary,
        since_date: editSince || null,
      })
      .eq('person_id', personId);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setEditing(false);
    await load();
  };

  const emails = emailList(person.emails);
  const phones = phoneList(person.phones);

  const openSendEmail = () => {
    setEmailTo(emails[0]?.address ?? '');
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
      personId: person.id,
      to: emailTo.trim(),
      subject: emailSubject.trim(),
      bodyText: emailBody.trim(),
      companyId: profile.company_id ?? undefined,
    });
    setEmailBusy(false);
    if (err) {
      setEmailError(err);
      return;
    }
    setShowSendEmail(false);
    setRefreshKey((k) => k + 1);
  };

  const openSchedule = () => {
    setMeetingSubject(`Meeting: ${personName(person)}`);
    setMeetingWhen('');
    setMeetingDuration('30');
    setMeetingError(null);
    setMeetingLink(null);
    setShowSchedule(true);
  };

  const submitSchedule = async () => {
    const attendee = emails[0]?.address;
    if (!attendee) {
      setMeetingError('This contact has no email on file to invite.');
      return;
    }
    if (!meetingSubject.trim() || !meetingWhen) {
      setMeetingError('Subject and date/time are required.');
      return;
    }
    setMeetingBusy(true);
    setMeetingError(null);
    const { data, error: err } = await scheduleMeeting({
      personId: person.id,
      attendeeEmails: [attendee],
      subject: meetingSubject.trim(),
      startIso: new Date(meetingWhen).toISOString(),
      durationMinutes: Number(meetingDuration) || 30,
      companyId: profile.company_id ?? undefined,
    });
    setMeetingBusy(false);
    if (err) {
      setMeetingError(err);
      return;
    }
    setMeetingLink(data?.meetLink ?? null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <RecordPage
      title={personName(person)}
      icon={<ContactCardIcon size={40} />}
      titleExtras={
        <span className="sales-badges">
          <Badge tone="neutral">contact</Badge>
          {profile.is_primary && <Badge tone="primary">primary</Badge>}
          {person.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      }
      actionBar={
        <>
          <Button
            size="sm"
            disabled={emails.length === 0}
            title={emails.length === 0 ? 'No email on file for this contact' : undefined}
            onClick={openSendEmail}
          >
            Send email
          </Button>
          <Button
            size="sm"
            disabled={emails.length === 0}
            title={emails.length === 0 ? 'No email on file for this contact' : undefined}
            onClick={openSchedule}
          >
            Schedule meeting
          </Button>
          {canEdit && (
            <Button variant="primary" size="sm" onClick={openEdit}>
              Edit contact profile
            </Button>
          )}
        </>
      }
    >
      <RecordSection title="Person Details">
        <dl className="sales-record-meta">
          <div>
            <dt>Emails</dt>
            <dd>
              {emails.length > 0
                ? emails.map((e) => `${e.address} (${e.type})`).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Phones</dt>
            <dd>
              {phones.length > 0
                ? phones.map((p) => `${p.number} (${p.type})`).join(', ')
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{locationLabel(person) || '—'}</dd>
          </div>
          <div>
            <dt>LinkedIn</dt>
            <dd>
              {person.linkedin_public_url ? (
                <a
                  href={person.linkedin_public_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Profile
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection title="Contact Profile">
        <dl className="sales-record-meta">
          <div>
            <dt>Company</dt>
            <dd>{companyName(profile.company_id)}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{profile.title ?? '—'}</dd>
          </div>
          <div>
            <dt>Contact since</dt>
            <dd>{fmtDate(profile.since_date)}</dd>
          </div>
          <div>
            <dt>Headline</dt>
            <dd>{person.headline ?? '—'}</dd>
          </div>
        </dl>
      </RecordSection>

      {deals.length > 0 && (
        <RecordSection title={`Deals (${deals.length})`}>
          <Table
            columns={[
              { key: 'display_code', header: 'Code' },
              { key: 'name', header: 'Deal' },
              {
                key: 'stage',
                header: 'Stage',
                render: (d: Deal) => <StatusBadge status={d.stage} />,
              },
              {
                key: 'value',
                header: 'Value',
                render: (d: Deal) => fmtMoney(d.value, d.currency),
              },
            ]}
            rows={deals}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/sales/deals/${d.id}`)}
          />
        </RecordSection>
      )}

      <RecordSection title="Engagement">
        <EngagementPanel relatedType="person" relatedId={person.id} refreshKey={refreshKey} />
      </RecordSection>

      {showSendEmail && (
        <Modal title="Send email" onClose={() => setShowSendEmail(false)}>
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
              className="sales-textarea"
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </div>
          <p className="text-secondary">
            Sends through your own connected Gmail account — appears in your Sent folder.
          </p>
          {emailError && <span className="field-error-text">{emailError}</span>}
          <div className="sales-modal-actions">
            <Button onClick={() => setShowSendEmail(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void submitSendEmail()} disabled={emailBusy}>
              {emailBusy ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </Modal>
      )}

      {showSchedule && (
        <Modal title="Schedule meeting" onClose={() => setShowSchedule(false)}>
          {meetingLink ? (
            <>
              <p>
                Meeting created.{' '}
                <a href={meetingLink} target="_blank" rel="noreferrer">
                  Join with Google Meet
                </a>
              </p>
              <div className="sales-modal-actions">
                <Button variant="primary" onClick={() => setShowSchedule(false)}>
                  Done
                </Button>
              </div>
            </>
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
                {emails[0]?.address ?? 'this contact'}.
              </p>
              {meetingError && <span className="field-error-text">{meetingError}</span>}
              <div className="sales-modal-actions">
                <Button onClick={() => setShowSchedule(false)}>Cancel</Button>
                <Button variant="primary" onClick={() => void submitSchedule()} disabled={meetingBusy}>
                  {meetingBusy ? 'Creating…' : 'Create meeting'}
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}

      {editing && (
        <Modal title="Edit contact profile" onClose={() => setEditing(false)}>
          <Select
            label="Company"
            options={companyOptions}
            placeholder="No company"
            value={editCompanyId}
            onChange={(e) => setEditCompanyId(e.target.value)}
          />
          <Input
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
          />
          <Input
            label="Contact since"
            type="date"
            value={editSince}
            onChange={(e) => setEditSince(e.target.value)}
          />
          <label className="sales-checkbox">
            <input
              type="checkbox"
              checked={editIsPrimary}
              onChange={(e) => setEditIsPrimary(e.target.checked)}
            />
            Primary contact for the company
          </label>
          {saveError && <span className="field-error-text">{saveError}</span>}
          <div className="sales-modal-actions">
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveProfile}>
              Save
            </Button>
          </div>
        </Modal>
      )}
    </RecordPage>
  );
}
