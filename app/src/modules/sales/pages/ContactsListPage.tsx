// Contacts = people rows that carry a contact_profiles row. The query starts
// from contact_profiles and joins people/companies client-side, so a BD user
// never asks for people outside their RLS window (and nothing
// candidate-shaped is ever requested).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db as supabase } from '../db';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { TaleoPlaceholderAction } from '../../../shell/TaleoPlaceholder';
import { ContactCardIcon } from '../../../shell/icons';
import { useCanEditCrm, useCompanyOptions } from '../hooks';
import {
  emailList,
  fmtDate,
  personName,
  primaryEmail,
  primaryPhone,
  type ContactProfile,
  type Person,
} from '../lib';

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

interface ContactRow {
  profile: ContactProfile;
  person: Person;
}

export function ContactsListPage() {
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { companyName, companyOptions } = useCompanyOptions();
  const [params] = useSearchParams();

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState(() => params.get('company_id') ?? '');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: profiles } = await supabase
        .from('contact_profiles')
        .select('*');
      if (!profiles || profiles.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      const { data: people } = await supabase
        .from('people')
        .select('*')
        .in(
          'id',
          profiles.map((p) => p.person_id),
        );
      if (cancelled) return;
      const personById = new Map((people ?? []).map((p) => [p.id, p]));
      setRows(
        profiles
          .map((profile) => ({
            profile,
            person: personById.get(profile.person_id),
          }))
          .filter((r): r is ContactRow => r.person !== undefined)
          .sort((a, b) =>
            personName(a.person).localeCompare(personName(b.person)),
          ),
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (companyFilter && r.profile.company_id !== companyFilter) {
        return false;
      }
      if (!q) return true;
      const emails = emailList(r.person.emails)
        .map((e) => e.address)
        .join(' ');
      return `${personName(r.person)} ${emails}`.toLowerCase().includes(q);
    });
  }, [rows, search, companyFilter]);

  const columns: TableColumn<ContactRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (r) => shortId(r.profile.person_id),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (r) => personName(r.person),
      render: (r) => (
        <span className="sales-badges">
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/sales/contacts/${r.profile.person_id}`);
            }}
          >
            <strong>{personName(r.person)}</strong>
          </button>
          {r.profile.is_primary && <Badge tone="primary">primary</Badge>}
          {r.person.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      sortValue: (r) => r.person.updated_at,
      render: (r) => fmtDate(r.person.updated_at),
    },
    {
      key: 'company',
      header: 'Account',
      sortable: true,
      sortValue: (r) => companyName(r.profile.company_id),
      render: (r) => companyName(r.profile.company_id),
    },
    {
      key: 'title',
      header: 'Title',
      render: (r) => r.profile.title ?? '—',
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => primaryPhone(r.person) || '—',
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => primaryEmail(r.person) || '—',
    },
    {
      key: 'since',
      header: 'Since',
      sortable: true,
      sortValue: (r) => r.profile.since_date ?? '',
      render: (r) => fmtDate(r.profile.since_date),
    },
  ];

  const exportRows = visible
    .filter((r) => !r.person.is_test)
    .map((r) => ({
      name: personName(r.person),
      title: r.profile.title,
      company: companyName(r.profile.company_id),
      email: primaryEmail(r.person),
      phone: primaryPhone(r.person),
      since_date: r.profile.since_date,
    }));

  return (
    <ListPage
      title="Contacts: Home"
      icon={<ContactCardIcon size={40} />}
      description="Contacts are all of the individuals outside of your organization that you need to track in Front Office OS."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search name or email…"
      actions={
        canEdit ? (
          <Button
            variant="primary"
            onClick={() => navigate('/sales/contacts/new')}
          >
            New Contact
          </Button>
        ) : undefined
      }
      filterRail={
        <details className="taleo-advanced-search" open>
          <summary>Advanced Search</summary>
          <div className="taleo-advanced-search-body">
            <Select
              label="Company"
              options={companyOptions}
              placeholder="All companies"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            />
          </div>
        </details>
      }
      exportRows={exportRows}
      exportFilename="contacts.csv"
    >
      <div className="record-action-bar taleo-list-action-bar">
        {/* FOOS-TBD: no list-level bulk email handler exists — the real,
            working Send Email is on the contact record page, wired to the
            Google integration. */}
        <TaleoPlaceholderAction
          label="Send Email"
          size="sm"
          detail="Bulk email from the contact list isn't implemented — open a contact record to send a real email."
        />
        {/* FOOS-TBD: no bulk-delete handler exists yet for contacts. */}
        <TaleoPlaceholderAction
          label="Delete"
          size="sm"
          detail="Bulk delete isn't implemented for contacts yet."
        />
      </div>

      <div className="taleo-pager">
        {visible.length > 0 ? `1-${visible.length} of ${rows.length}` : `0 of ${rows.length}`}
      </div>

      <Table
        columns={columns}
        rows={visible}
        rowKey={(r) => r.profile.person_id}
        onRowClick={(r) => navigate(`/sales/contacts/${r.profile.person_id}`)}
        emptyText="No contacts match."
      />
    </ListPage>
  );
}
