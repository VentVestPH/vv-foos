import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Database } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { useListLink } from '../../../lib/listReturn';
import { RecordSection } from '../../../components/ui/RecordPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Contact as ContactCardIcon } from 'lucide-react';
import { useCanEditCrm, useCompanyOptions } from '../hooks';
import {
  fmtDate,
  personName,
  primaryEmail,
  primaryPhone,
} from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

type ContactListRow = Omit<Database['public']['Views']['contact_list']['Row'], 'search_text'>;

interface ContactRow {
  profile: ContactListRow;
  person: ContactListRow;
}

const CONTACT_PAGE_SIZE = 20;
const CONTACT_EXPORT_PAGE_SIZE = 1000;
const CONTACT_EXPORT_ROW_CAP = 10000;

const CONTACT_VIEW_COLUMNS =
  'person_id, first_name, middle_name, last_name, full_name, emails, phones, city, state, country, is_test, person_updated_at, company_id, company_name, title, is_primary, since_date';

const CONTACT_SORT_COLUMNS: Record<string, string> = {
  name: 'last_name',
  updated_at: 'person_updated_at',
  company: 'company_name',
  title: 'title',
  since_date: 'since_date',
  email: 'first_name',
};

function contactLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function contactBaseQuery() {
  return supabase.from('contact_list').select(CONTACT_VIEW_COLUMNS, { count: 'exact' });
}

type ContactQuery = ReturnType<typeof contactBaseQuery>;

export function ContactsListPage() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const openRecord = useListLink();
  const canEdit = useCanEditCrm();
  const { companyName, companyOptions } = useCompanyOptions();
  const [params] = useSearchParams();

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState(() => params.get('company_id') ?? '');

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const applyContactFilters = useCallback(
    (q: ContactQuery): ContactQuery => {
      let out = q;
      if (companyFilter) out = out.eq('company_id', companyFilter);
      const term = search.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${contactLikeLiteral(term)}%`);
      const sortColumn = sort ? CONTACT_SORT_COLUMNS[sort.key] : undefined;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('last_name', { ascending: true }).order('first_name', { ascending: true });
      }
      return out.order('person_id', { ascending: true });
    },
    [companyFilter, search, sort],
  );

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      const start = page * CONTACT_PAGE_SIZE;
      const { data, count, error } = await applyContactFilters(contactBaseQuery()).range(
        start,
        start + CONTACT_PAGE_SIZE - 1,
      );
      if (error) throw new Error(error.message);
      if (!isCurrent()) return;
      setRows((data ?? []).map((row) => ({ profile: row, person: row })));
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [applyContactFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [companyFilter, search, sort]);

  useEffect(() => {
    void load();
  }, [load]);

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
              openRecord(`/sales/contacts/${r.profile.person_id}`);
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
      sortValue: (r) => r.person.person_updated_at,
      render: (r) => fmtDate(r.person.person_updated_at),
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
      render: (r) => r.profile.title ?? EMPTY_CELL,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => primaryPhone(r.person) || EMPTY_CELL,
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => primaryEmail(r.person) || EMPTY_CELL,
    },
    {
      key: 'since',
      header: 'Since',
      sortable: true,
      hideWhenEmpty: true,
      sortValue: (r) => r.profile.since_date ?? '',
      render: (r) => fmtDate(r.profile.since_date),
    },
  ];

  const exportContactRows = useCallback(async () => {
    if (total > CONTACT_EXPORT_ROW_CAP) {
      return [];
    }
    const collected: ContactListRow[] = [];
    for (let start = 0; start < CONTACT_EXPORT_ROW_CAP; start += CONTACT_EXPORT_PAGE_SIZE) {
      const { data, error } = await applyContactFilters(contactBaseQuery()).range(
        start,
        start + CONTACT_EXPORT_PAGE_SIZE - 1,
      );
      if (error) return [];
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < CONTACT_EXPORT_PAGE_SIZE) break;
    }
    return collected
      .filter((r) => !r.is_test)
      .map((r) => ({
        name: personName(r),
        title: r.title,
        company: r.company_name ?? '',
        email: primaryEmail(r),
        phone: primaryPhone(r),
        since_date: r.since_date,
      }));
  }, [applyContactFilters, total]);

  const pageCount = Math.max(1, Math.ceil(total / CONTACT_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * CONTACT_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * CONTACT_PAGE_SIZE),
    pageRows: rows,
  };

  return (
    <ListPage
      title="Contacts"
      icon={<ContactCardIcon size={32} />}
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
        <RecordSection title="Advanced Search">
          <div className="fo-advanced-search-body">
            <Select
              label="Company"
              options={companyOptions}
              placeholder="All companies"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
            />
          </div>
        </RecordSection>
      }
      exportRows={exportContactRows}
      exportCount={total}
      exportFilename="contacts.csv"
    >
      <div className="record-action-bar fo-list-action-bar">
        <PlaceholderAction
          label="Send Email"
          size="sm"
          detail="Bulk email from the contact list isn't implemented — open a contact record to send a real email."
        />
        <PlaceholderAction
          label="Delete"
          size="sm"
          detail="Bulk delete isn't implemented for contacts yet."
        />
      </div>

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      <Table
        busy={loading}
        columns={columns}
        rows={pager.pageRows}
        rowKey={(r) => r.profile.person_id}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        onRowClick={(r) => openRecord(`/sales/contacts/${r.profile.person_id}`)}
        emptyText="No contacts match."
      />

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
    </ListPage>
  );
}
