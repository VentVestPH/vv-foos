import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db as supabase } from '../db';
import { useRole } from '../../../auth/SessionProvider';
import { useRecentlyViewed } from '../../../hooks/useRecentlyViewed';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { RecordPage, RecordSection } from '../../../components/ui/RecordPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { HandshakeIcon } from '../../../shell/icons';
import { EngagementPanel } from '../components/EngagementPanel';
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

export function CompanyRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = useRole();
  const { record } = useRecentlyViewed();
  const { staffName } = useStaffList();

  const [company, setCompany] = useState<Company | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [requisitions, setRequisitions] = useState<RequisitionLite[]>([]);
  const [loaded, setLoaded] = useState(false);

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
      if (canSeeRequisitions) {
        const { data } = await supabase
          .from('requisitions')
          .select('id, display_code, title, status')
          .eq('company_id', companyId);
        reqs = data ?? [];
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
      setLoaded(true);
    }

    void load(id);
    return () => {
      cancelled = true;
    };
  }, [id, canSeeRequisitions]);

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
      sortable: true,
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
      render: (r) => r.profile.title ?? '—',
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => primaryEmail(r.person) || '—',
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
    { key: 'display_code', header: 'Code', sortable: true },
    { key: 'name', header: 'Deal', sortable: true },
    {
      key: 'stage',
      header: 'Stage',
      render: (d) => <StatusBadge status={d.stage} />,
    },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
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
      title={company.name}
      icon={<HandshakeIcon size={40} />}
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
    >
      <RecordSection title="Details">
        <dl className="sales-record-meta">
          <div>
            <dt>Website</dt>
            <dd>{company.website ?? '—'}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{company.phone ?? '—'}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{locationLabel(company) || '—'}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>{staffName(company.owner_id)}</dd>
          </div>
        </dl>
      </RecordSection>

      <RecordSection title={`Contacts (${contacts.length})`}>
        <Table
          columns={contactColumns}
          rows={contacts}
          rowKey={(r) => r.profile.person_id}
          onRowClick={(r) => navigate(`/sales/contacts/${r.profile.person_id}`)}
          emptyText="No contacts at this company yet."
        />
      </RecordSection>

      <RecordSection title={`Open deals (${openDeals.length})`}>
        <Table
          columns={dealColumns}
          rows={openDeals}
          rowKey={(d) => d.id}
          onRowClick={(d) => navigate(`/sales/deals/${d.id}`)}
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
        <RecordSection title={`Requisitions (${requisitions.length})`}>
          <Table
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
            Read-only — requisitions are managed in the Recruit module.
          </div>
        </RecordSection>
      )}

      <RecordSection title="Activity">
        <EngagementPanel relatedType="company" relatedId={company.id} />
      </RecordSection>
    </RecordPage>
  );
}
