import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useListLink, useListReturnHref } from '../../../lib/listReturn';
import { supabase } from '../../../lib/supabase';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { RecordSkeleton } from '../../../components/ui/RecordSkeleton';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { SectionSettingsDialog } from '../../../components/ui/SectionSettingsDialog';
import { useSectionPrefs } from '../../../hooks/useSectionPrefs';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { ContactDeleteDialog } from '../components/ContactDeleteDialog';
import { ContactEditDialog } from '../components/ContactEditDialog';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { Table } from '../../../components/ui/Table';
import { Contact as ContactCardIcon, PencilLine } from 'lucide-react';
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
import { EMPTY_CELL } from '../../../lib/format';

const CONTACT_RECORD_SECTIONS = [
  'Person Details',
  'Contact Profile',
  'Deals',
  'Engagement',
];

const CONTACT_SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  'Person Details': true,
  'Contact Profile': true,
  Deals: true,
  Engagement: true,
};

export function ContactRecordPage() {
  const { personId } = useParams<{ personId: string }>();
  const canEdit = useCanEditCrm();
  const { record } = useRecentlyViewed();
  const { companyName } = useCompanyOptions();

  const [person, setPerson] = useState<Person | null>(null);
  const [profile, setProfile] = useState<ContactProfile | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const showSkeleton = useMinimumVisible(!loaded);
  const prefs = useSectionPrefs('sales.contact.record');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingPerson, setEditingPerson] = useState(false);
  const opensOnLoad = (section: string) =>
    prefs.opensOnLoad(section, CONTACT_SECTION_DEFAULT_OPEN[section] ?? true);
  const listHref = useListReturnHref('/sales/contacts');
  const openRecord = useListLink();


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
  if (showSkeleton) {
    return <RecordSkeleton label="Loading contact" sections={CONTACT_RECORD_SECTIONS.length} />;
  }
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
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Contacts', to: listHref },
        { label: personName(person) },
      ]}
      title={personName(person)}
      icon={<ContactCardIcon size={32} />}
      titleExtras={
        <span className="sales-badges">
          <Badge tone="neutral">Contact</Badge>
          {profile.is_primary && <Badge tone="primary">primary</Badge>}
          {person.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      }
      headerActions={
        <>
          <SettingsButton
            label="Section settings"
            title="Choose which sections appear on this contact"
            onClick={() => setSettingsOpen(true)}
          />
        </>
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
          {canEdit && (
            <>
              <Button size="sm" onClick={() => setEditingPerson(true)}>
                <PencilLine size={20} aria-hidden="true" />
                Edit
              </Button>
              <ActionMenu
                label="More actions"
                iconOnly
                items={[
                  {
                    label: 'Schedule meeting',
                    onSelect: openSchedule,
                    disabled: emails.length === 0,
                    title: emails.length === 0 ? 'No email on file for this contact' : undefined,
                  },
                  {
                    label: 'Delete permanently…',
                    destructive: true,
                    onSelect: () => setDeleting(true),
                  },
                ]}
              />
            </>
          )}
        </>
      }
    >
      <RecordSection
        title="Person Details"
        hidden={prefs.isHidden('Person Details')}
        defaultOpen={opensOnLoad('Person Details')}
      >
        <dl className="sales-record-meta">
          <div>
            <dt>Emails</dt>
            <dd>
              {emails.length > 0
                ? emails.map((e) => `${e.address} (${e.type})`).join(', ')
                : EMPTY_CELL}
            </dd>
          </div>
          <div>
            <dt>Phones</dt>
            <dd>
              {phones.length > 0
                ? phones.map((p) => `${p.number} (${p.type})`).join(', ')
                : EMPTY_CELL}
            </dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{locationLabel(person) || EMPTY_CELL}</dd>
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
                EMPTY_CELL
              )}
            </dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection
        title="Contact Profile"
        hidden={prefs.isHidden('Contact Profile')}
        defaultOpen={opensOnLoad('Contact Profile')}
      >
        <dl className="sales-record-meta">
          <div>
            <dt>Company</dt>
            <dd>{companyName(profile.company_id)}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{profile.title ?? EMPTY_CELL}</dd>
          </div>
          <div>
            <dt>Contact since</dt>
            <dd>{fmtDate(profile.since_date)}</dd>
          </div>
          <div>
            <dt>Headline</dt>
            <dd>{person.headline ?? EMPTY_CELL}</dd>
          </div>
        </dl>
      </RecordSection>

      {deals.length > 0 && (
        <RecordSection
          title="Deals"
          count={deals.length}
          hidden={prefs.isHidden('Deals')}
          defaultOpen={opensOnLoad('Deals')}
        >
          <Table
            pageSize={10}
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
            onRowClick={(d) => openRecord(`/sales/deals/${d.id}`)}
          />
        </RecordSection>
      )}

      <RecordSection
        title="Engagement"
        hidden={prefs.isHidden('Engagement')}
        defaultOpen={opensOnLoad('Engagement')}
      >
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
            <label className="field-label" htmlFor="contact-email-body">
              Message
            </label>
            <textarea
              id="contact-email-body"
              className="sales-textarea"
              rows={6}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </div>
          <p className="text-secondary">
            Sends through your own connected Gmail account — appears in your Sent folder.
          </p>
          {emailError && <span className="field-error-text" role="alert">{emailError}</span>}
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
              {meetingError && <span className="field-error-text" role="alert">{meetingError}</span>}
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

      {editingPerson && (
        <ContactEditDialog
          person={person}
          profile={profile}
          onClose={() => setEditingPerson(false)}
          onSaved={() => {
            setEditingPerson(false);
            void load();
          }}
        />
      )}
      {deleting && (
        <ContactDeleteDialog
          targets={[
            {
              personId: person.id,
              name: personName(person),
              companyName: profile.company_id ? companyName(profile.company_id) : null,
            },
          ]}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            navigate(listHref);
          }}
        />
      )}
      {settingsOpen && (
        <SectionSettingsDialog
          title="Section settings"
          hint="Choose which sections appear on this contact. The choice is saved to your account."
          sections={CONTACT_RECORD_SECTIONS}
          prefs={prefs}
          defaultOpenFor={(section) => CONTACT_SECTION_DEFAULT_OPEN[section] ?? true}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </RecordPage>
  );
}
