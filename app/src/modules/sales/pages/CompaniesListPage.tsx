import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager, usePagination } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Handshake as HandshakeIcon } from 'lucide-react';
import { useCanEditCrm, useStaffList } from '../hooks';
import { fmtDate, locationLabel, type Company } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';
import { fetchAllRows } from '../../../lib/fetchAll';

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

  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
      setLoading(true);
    void fetchAllRows((f, t) =>
      supabase.from('companies').select('*').order('name').range(f, t),
    ).then((rows) => {
      if (!cancelled) {
        setCompanies(rows);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const loc = locationFilter.trim().toLowerCase();
    return companies.filter((c) => {
      if (q && !`${c.name} ${c.website ?? ''}`.toLowerCase().includes(q)) {
        return false;
      }
      if (typeFilter && !c.types.includes(typeFilter as Company['types'][number])) {
        return false;
      }
      if (ownerFilter && c.owner_id !== ownerFilter) return false;
      if (loc && !locationLabel(c).toLowerCase().includes(loc)) return false;
      return true;
    });
  }, [companies, search, typeFilter, ownerFilter, locationFilter]);

  const columns: TableColumn<Company>[] = [
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
          {c.types.map((t) => (
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

  const exportRows = visible
    .filter((c) => !c.is_test)
    .map((c) => ({
      name: c.name,
      types: c.types.join('|'),
      website: c.website,
      city: c.city,
      state: c.state,
      country: c.country,
      phone: c.phone,
      owner: staffName(c.owner_id),
    }));

  const pager = usePagination(visible);

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
      exportRows={exportRows}
      exportFilename="companies.csv"
    >
      <div className="record-action-bar fo-list-action-bar">
        {}
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
        onRowClick={(c) => navigate(`/sales/companies/${c.id}`)}
        emptyText={loading ? 'Loading…' : "No companies match."}
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
