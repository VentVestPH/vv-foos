import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Database } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Handshake as HandshakeIcon } from 'lucide-react';
import { useCanEditCrm, useStaffList } from '../hooks';
import { fmtDate } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

const COMPANY_PAGE_SIZE = 20;
const COMPANY_EXPORT_PAGE_SIZE = 1000;
const COMPANY_EXPORT_ROW_CAP = 10000;

const COMPANY_VIEW_COLUMNS =
  'id, name, types, website, city, state, country, phone, owner_id, owner_name, is_test, created_at, updated_at, location_text';

const COMPANY_SORT_COLUMNS: Record<string, string> = {
  name: 'name',
  website: 'website',
  location: 'location_text',
  phone: 'phone',
  owner: 'owner_name',
  updated_at: 'updated_at',
  types: 'name',
};

type CompanyListRow = Omit<Database['public']['Views']['company_list']['Row'], 'search_text'>;

function companyLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function companyBaseQuery() {
  return supabase.from('company_list').select(COMPANY_VIEW_COLUMNS, { count: 'exact' });
}

type CompanyQuery = ReturnType<typeof companyBaseQuery>;

const TYPE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'employer', label: 'Employer' },
  { value: 'prospect', label: 'Prospect' },
];

export function CompaniesListPage() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const canEdit = useCanEditCrm();
  const { staffName, staffOptions } = useStaffList();

  const [companies, setCompanies] = useState<CompanyListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const applyCompanyFilters = useCallback(
    (q: CompanyQuery): CompanyQuery => {
      let out = q;
      if (typeFilter) out = out.contains('types', [typeFilter]);
      if (ownerFilter) out = out.eq('owner_id', ownerFilter);
      const loc = locationFilter.trim();
      if (loc) out = out.ilike('location_text', `%${companyLikeLiteral(loc)}%`);
      const term = search.trim().toLowerCase();
      if (term) out = out.ilike('search_text', `%${companyLikeLiteral(term)}%`);
      const sortColumn = sort ? COMPANY_SORT_COLUMNS[sort.key] : undefined;
      if (sortColumn) {
        out = out.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false });
      } else {
        out = out.order('name', { ascending: true });
      }
      return out.order('id', { ascending: true });
    },
    [typeFilter, ownerFilter, locationFilter, search, sort],
  );

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      const start = page * COMPANY_PAGE_SIZE;
      const { data, count, error } = await applyCompanyFilters(companyBaseQuery()).range(
        start,
        start + COMPANY_PAGE_SIZE - 1,
      );
      if (error) throw new Error(error.message);
      if (!isCurrent()) return;
      setCompanies(data ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [applyCompanyFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, ownerFilter, locationFilter, search, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<CompanyListRow>[] = [
    {
      key: 'id',
      header: 'ID',
      render: (c) => c.id.slice(0, 8).toUpperCase(),
    },
    {
      key: 'name',
      header: 'Account Name',
      sortable: true,
      render: (c) => (
        <span className="sales-badges">
          <button
            type="button"
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/sales/companies/${c.id}`);
            }}
          >
            {c.name}
          </button>
          {c.is_test && <Badge tone="warning">TEST</Badge>}
        </span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      render: (c) => fmtDate(c.updated_at),
    },
    {
      key: 'city',
      header: 'City',
      sortable: true,
      render: (c) => c.city ?? EMPTY_CELL,
    },
    {
      key: 'state',
      header: 'State/Territory',
      sortable: true,
      render: (c) => c.state ?? EMPTY_CELL,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => c.phone ?? EMPTY_CELL,
    },
    {
      key: 'types',
      header: 'Type',
      render: (c) => (
        <span className="sales-badges">
          {c.types.map((t: string) => (
            <Badge key={t} tone={t === 'client' ? 'primary' : 'neutral'}>
              {t}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      key: 'country',
      header: 'Country',
      render: (c) => c.country ?? EMPTY_CELL,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (c) => staffName(c.owner_id),
      render: (c) => staffName(c.owner_id),
    },
    {
      key: 'website',
      header: 'Website',
      render: (c) => c.website ?? EMPTY_CELL,
    },
  ];

  const exportCompanyRows = useCallback(async () => {
    if (total > COMPANY_EXPORT_ROW_CAP) return [];
    const collected: CompanyListRow[] = [];
    for (let start = 0; start < COMPANY_EXPORT_ROW_CAP; start += COMPANY_EXPORT_PAGE_SIZE) {
      const { data, error } = await applyCompanyFilters(companyBaseQuery()).range(
        start,
        start + COMPANY_EXPORT_PAGE_SIZE - 1,
      );
      if (error) return [];
      const batch = data ?? [];
      collected.push(...batch);
      if (batch.length < COMPANY_EXPORT_PAGE_SIZE) break;
    }
    return collected
      .filter((c) => !c.is_test)
      .map((c) => ({
        name: c.name,
        types: c.types.join('|'),
        website: c.website,
        city: c.city,
        state: c.state,
        country: c.country,
        phone: c.phone,
        owner: c.owner_name ?? '',
      }));
  }, [applyCompanyFilters, total]);

  const pageCount = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * COMPANY_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * COMPANY_PAGE_SIZE),
    pageRows: companies,
  };

  return (
    <ListPage
      title="Accounts"
      icon={<HandshakeIcon size={40} />}
      description="Accounts are the companies and organizations involved with your business such as employers, customers, search firms, agencies, etc."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search companies…"
      actions={
        canEdit ? (

          <Button variant="primary" onClick={() => navigate('/sales/companies/new')}>
            New Account
          </Button>
        ) : undefined
      }
      filterRail={
        <details className="fo-advanced-search" open>
          <summary>Advanced Search</summary>
          <div className="fo-advanced-search-body">
            <Select
              label="Type"
              options={TYPE_OPTIONS}
              placeholder="All types"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
            <Select
              label="Owner"
              options={staffOptions}
              placeholder="All owners"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
            />
            <Input
              label="Location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="City, state, country"
            />
          </div>
        </details>
      }
      exportRows={exportCompanyRows}
      exportCount={total}
      exportFilename="companies.csv"
    >
      <div className="record-action-bar fo-list-action-bar">
        <PlaceholderAction
          label="Delete"
          detail="Bulk delete isn't implemented for accounts yet."
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
        rowKey={(c) => c.id}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        onRowClick={(c) => navigate(`/sales/companies/${c.id}`)}
        emptyText="No companies match."
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
