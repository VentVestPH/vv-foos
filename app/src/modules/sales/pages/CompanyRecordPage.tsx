import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useListLink, useListReturnHref } from '../../../lib/listReturn';
import { supabase } from '../../../lib/supabase';
import { useRole } from '../../../auth/SessionProvider';
import { useNavigate } from 'react-router-dom';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ActionMenu } from '../../../components/ui/ActionMenu';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { RecordSkeleton } from '../../../components/ui/RecordSkeleton';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Handshake as HandshakeIcon, PencilLine } from 'lucide-react';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import { SectionSettingsDialog } from '../../../components/ui/SectionSettingsDialog';
import { useSectionPrefs } from '../../../hooks/useSectionPrefs';
import { EngagementPanel } from '../components/EngagementPanel';
import { CompanyDeleteDialog } from '../components/CompanyDeleteDialog';
import { CompanyEditDialog } from '../components/CompanyEditDialog';
import { useCanEditCrm } from '../hooks';
import { useStaffList } from '../hooks';
import {
  fmtDate,
  fmtMoney,
  locationLabel,
  personName,
  primaryEmail,
  type Company,
  type ContactProfile,
  type Deal,
  type Person,
} from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

interface ContactRow {
  profile: ContactProfile;
  person: Person;
}

interface RequisitionLite {
  id: string;
  display_code: string;
  title: string;
  status: string;
}

const RELATED_ROW_CAP = 25;

const COMPANY_RECORD_SECTIONS = [
  'Details',
  'Contacts',
  'Open deals',
  'Requisitions',
  'Activity',
];

const COMPANY_SECTION_DEFAULT_OPEN: Record<string, boolean> = {
  Details: true,
  Contacts: true,
  'Open deals': true,
  Requisitions: true,
  Activity: true,
};

export function CompanyRecordPage() {
  const prefs = useSectionPrefs('sales.company.record');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const opensOnLoad = (section: string) =>
    prefs.opensOnLoad(section, COMPANY_SECTION_DEFAULT_OPEN[section] ?? true);
  const { id } = useParams<{ id: string }>();
  const role = useRole();
  const { record } = useRecentlyViewed();
  const { staffName } = useStaffList();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionLite[]>([]);
  const [requisitionTotal, setRequisitionTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const showSkeleton = useMinimumVisible(!loaded);
  const listHref = useListReturnHref('/sales/companies');
  const openRecord = useListLink();

  const canSeeRequisitions = role === 'admin' || role === 'recruiter';

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load(companyId: string) {
      const [companyRes, profileRes, dealRes] = await Promise.all([
        supabase.from('companies').select('*').eq('id', companyId).maybeSingle(),
        supabase.from('contact_profiles').select('*').eq('company_id', companyId),
        supabase
          .from('deals')
          .select('*')
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false }),
      ]);

      const profiles = profileRes.data ?? [];
      let people: Person[] = [];
      if (profiles.length > 0) {
        const { data } = await supabase
          .from('people')
          .select('*')
          .in(
            'id',
            profiles.map((p) => p.person_id),
          );
        people = data ?? [];
      }

      let reqs: RequisitionLite[] = [];
      let reqTotal = 0;
      if (canSeeRequisitions) {
        const { data, count } = await supabase
          .from('requisitions')
          .select('id, display_code, title, status', { count: 'exact' })
          .eq('company_id', companyId)
          .order('opened_date', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .range(0, RELATED_ROW_CAP - 1);
        reqs = data ?? [];
        reqTotal = count ?? reqs.length;
      }

      if (cancelled) return;
      const personById = new Map(people.map((p) => [p.id, p]));
      setCompany(companyRes.data ?? null);
      setContacts(
        profiles
          .map((profile) => ({
            profile,
            person: personById.get(profile.person_id),
          }))
          .filter((r): r is ContactRow => r.person !== undefined),
      );
      setDeals(dealRes.data ?? []);
      setRequisitions(reqs);
      setRequisitionTotal(reqTotal);
      setRequisitionTotal(reqTotal);
      setLoaded(true);
    }

    void load(id);
    return () => {
      cancelled = true;
    };
  }, [id, canSeeRequisitions, reloadKey]);

  useEffect(() => {
    if (company) {
      record({
        type: 'company',
        id: company.id,
        label: company.name,
        href: `/sales/companies/${company.id}`,
      });
    }
  }, [company, record]);

  if (!id) return null;
  if (showSkeleton) {
    return <RecordSkeleton label="Loading account" sections={COMPANY_RECORD_SECTIONS.length} />;
  }
  if (loaded && !company) {
    return (
      <div className="stub-panel">
        <h1>Company not found</h1>
      </div>
    );
  }
  if (!company) return null;

  const contactColumns: TableColumn<ContactRow>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (r) => personName(r.person),
      render: (r) => (
        <span className="sales-badges">
          {personName(r.person)}
          {r.profile.is_primary && <Badge tone="primary">primary</Badge>}
        </span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (r) => r.profile.title ?? EMPTY_CELL,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => primaryEmail(r.person) || EMPTY_CELL,
    },
    {
      key: 'since',
      header: 'Since',
      render: (r) => fmtDate(r.profile.since_date),
    },
  ];

  const openDeals = deals.filter(
    (d) => d.stage !== 'won' && d.stage !== 'lost',
  );
  const closedDeals = deals.filter(
    (d) => d.stage === 'won' || d.stage === 'lost',
  );

  const dealColumns: TableColumn<Deal>[] = [
    { key: 'display_code', header: 'Code' },
    { key: 'name', header: 'Deal' },
    {
      key: 'stage',
      header: 'Stage',
      render: (d) => <StatusBadge status={d.stage} />,
    },
    {
      key: 'value',
      header: 'Value',
      sortValue: (d) => d.value ?? 0,
      render: (d) => fmtMoney(d.value, d.currency),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (d) => staffName(d.owner_id),
    },
  ];

  return (
    <RecordPage
      breadcrumbs={[
        { label: 'Home', to: '/' },
        { label: 'Accounts', to: listHref },
        { label: company.name },
      ]}
      title={company.name}
      icon={<HandshakeIcon size={32} />}
      titleExtras={
        <span className="sales-badges">
          {company.types.map((t) => (
            <Badge key={t} tone={t === 'client' ? 'primary' : 'neutral'}>
              {t}
            </Badge>
          ))}
          {company.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      }
      actionBar={
        canEdit ? (
          <>
            <Button size="sm" onClick={() => setEditing(true)}>
              <PencilLine size={20} aria-hidden="true" />
              Edit
            </Button>
            <ActionMenu
              label="More actions"
              iconOnly
              items={[
                {
                  label: 'Delete permanently…',
                  destructive: true,
                  onSelect: () => setDeleting(true),
                },
              ]}
            />
          </>
        ) : undefined
      }
      headerActions={
        <>
          <SettingsButton
            label="Section settings"
            title="Choose which sections appear on this account"
            onClick={() => setSettingsOpen(true)}
          />
        </>
      }
    >
      <RecordSection
        title="Details"
        hidden={prefs.isHidden('Details')}
        defaultOpen={opensOnLoad('Details')}
      >
        <dl className="sales-record-meta">
          <div>
            <dt>Website</dt>
            <dd>{company.website ?? EMPTY_CELL}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{company.phone ?? EMPTY_CELL}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{locationLabel(company) || EMPTY_CELL}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{staffName(company.owner_id)}</dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection
        title="Contacts"
        count={contacts.length}
        hidden={prefs.isHidden('Contacts')}
        defaultOpen={opensOnLoad('Contacts')}
      >
        <Table
          pageSize={10}
          busy={!loaded}
          columns={contactColumns}
          rows={contacts}
          rowKey={(r) => r.profile.person_id}
          onRowClick={(r) => openRecord(`/sales/contacts/${r.profile.person_id}`)}
          emptyText="No contacts at this company yet."
        />
      </RecordSection>

      <RecordSection
        title="Open deals"
        count={openDeals.length}
        hidden={prefs.isHidden('Open deals')}
        defaultOpen={opensOnLoad('Open deals')}
      >
        <Table
          pageSize={10}
          busy={!loaded}
          columns={dealColumns}
          rows={openDeals}
          rowKey={(d) => d.id}
          onRowClick={(d) => openRecord(`/sales/deals/${d.id}`)}
          emptyText="No open deals."
        />
        {closedDeals.length > 0 && (
          <div className="sales-panel-note">
            {closedDeals.length} closed deal(s) — see the Deals list for
            history.
          </div>
        )}
      </RecordSection>

      {canSeeRequisitions && (
        <RecordSection
          title="Requisitions"
          count={requisitionTotal}
          hidden={prefs.isHidden('Requisitions')}
          defaultOpen={opensOnLoad('Requisitions')}
        >
          <Table
            pageSize={10}
            columns={[
              { key: 'display_code', header: 'Code' },
              { key: 'title', header: 'Title' },
              {
                key: 'status',
                header: 'Status',
                render: (r: RequisitionLite) => (
                  <StatusBadge status={r.status} />
                ),
              },
            ]}
            rows={requisitions}
            rowKey={(r) => r.id}
            emptyText="No requisitions for this company."
          />
          <div className="sales-panel-note">
            {requisitionTotal > requisitions.length
              ? `Showing the ${requisitions.length} most recently opened of ${requisitionTotal}. Read-only: requisitions are managed in the Recruit module.`
              : 'Read-only: requisitions are managed in the Recruit module.'}
          </div>
        </RecordSection>
      )}

      <RecordSection
        title="Activity"
        hidden={prefs.isHidden('Activity')}
        defaultOpen={opensOnLoad('Activity')}
      >
        <EngagementPanel relatedType="company" relatedId={company.id} />
      </RecordSection>
      {editing && (
        <CompanyEditDialog
          company={company}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {deleting && (
        <CompanyDeleteDialog
          targets={[{ id: company.id, name: company.name }]}
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
          hint="Choose which sections appear on this account. The choice is saved to your account."
          sections={COMPANY_RECORD_SECTIONS}
          prefs={prefs}
          defaultOpenFor={(section) => COMPANY_SECTION_DEFAULT_OPEN[section] ?? true}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </RecordPage>
  );
}
