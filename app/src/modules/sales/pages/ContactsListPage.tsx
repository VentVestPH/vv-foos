import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Database } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { ListPage } from '../../../components/ui/ListPage';
import { useListLink } from '../../../lib/listReturn';
import { useSubmittedSearch } from '../../../lib/quickSearch';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ColumnSettingsDialog } from '../../../components/ui/ColumnSettingsDialog';
import { SettingsButton } from '../../../components/ui/SettingsButton';
import {
  SavedViewsControl,
  useSavedViews,
  type ViewState,
} from '../../../components/ui/SavedViews';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { useSession } from '../../../auth/SessionProvider';
import { contactSearchHints } from '../../../lib/searchHints';
import { ContactDeleteDialog, type ContactDeleteTarget } from '../components/ContactDeleteDialog';
import { Contact as ContactCardIcon, Mail, Plus, Trash2 } from 'lucide-react';
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

const COLUMN_DEFS: { key: string; header: string }[] = [
  { key: 'id', header: 'ID' },
  { key: 'name', header: 'Name' },
  { key: 'updated_at', header: 'Last Updated' },
  { key: 'company', header: 'Account' },
  { key: 'title', header: 'Title' },
  { key: 'phone', header: 'Phone' },
  { key: 'email', header: 'Email' },
  { key: 'since', header: 'Since' },
];

const ALL_COLUMN_KEYS = COLUMN_DEFS.map((c) => c.key);

const COLUMN_HEADER: Record<string, string> = Object.fromEntries(
  COLUMN_DEFS.map((c) => [c.key, c.header]),
);

const EMPTY_FILTERS = { company: '' };

type ContactFilters = typeof EMPTY_FILTERS;

export function ContactsListPage() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const openRecord = useListLink();
  const canEdit = useCanEditCrm();
  const { companyName, companyOptions } = useCompanyOptions();
  const [params] = useSearchParams();

  const [rows, setRows] = useState<ContactRow[]>([]);
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();
  const [filters, setFilters] = useState<ContactFilters>(() => ({
    company: params.get('company_id') ?? '',
  }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<ContactDeleteTarget[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(ALL_COLUMN_KEYS);
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mobile = useIsMobile();
  const canBulk = canEdit && !mobile;
  const { staff } = useSession();
  const savedViews = useSavedViews('contact');
  const visibleCols = useMemo(
    () => columnOrder.filter((key) => !hiddenCols.includes(key)),
    [columnOrder, hiddenCols],
  );

  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const applyContactFilters = useCallback(
    (q: ContactQuery): ContactQuery => {
      let out = q;
      if (filters.company) out = out.eq('company_id', filters.company);
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
    [filters, search, sort],
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
      setLoaded(true);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [applyContactFilters, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [filters, search, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = useMemo<TableColumn<ContactRow>[]>(() => {
    const defs: TableColumn<ContactRow>[] = [
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
    const byKey = new Map(defs.map((c) => [c.key, c]));
    return visibleCols.flatMap((key) => {
      const col = byKey.get(key);
      return col ? [col] : [];
    });
  }, [visibleCols, openRecord, companyName]);

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

  const changeSelection = useCallback((next: Set<string>) => {
    setNotice(null);
    setSelected(next);
  }, []);

  const currentState = useCallback(
    (): ViewState => ({ filters: { ...filters }, columns: visibleCols, sort }),
    [filters, visibleCols, sort],
  );

  const applyView = useCallback((state: ViewState) => {
    setFilters({ ...EMPTY_FILTERS, ...(state.filters as Partial<ContactFilters>) });
    if (state.columns.length > 0) {
      const saved = state.columns.filter((k) => ALL_COLUMN_KEYS.includes(k));
      setColumnOrder([...saved, ...ALL_COLUMN_KEYS.filter((k) => !saved.includes(k))]);
      setHiddenCols(ALL_COLUMN_KEYS.filter((k) => !saved.includes(k)));
    }
    setSort(state.sort);
  }, []);

  const showSkeleton = useMinimumVisible(loading);
  const narrowed = search.trim() !== '' || filters.company !== '';

  const selectedTargets: ContactDeleteTarget[] = rows
    .filter((r) => selected.has(r.profile.person_id))
    .map((r) => ({
      personId: r.profile.person_id,
      name: personName(r.person),
      companyName: companyName(r.profile.company_id),
    }));

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
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Contacts' }]}
      title="Contacts"
      icon={<ContactCardIcon size={32} />}
      description="Contacts are all of the individuals outside of your organization that you need to track in Front Office OS."
      flush
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchHints={contactSearchHints}
      searchPlaceholder="Search name, title, account…"
      savedViewsSlot={
        <SavedViewsControl
          views={savedViews.views}
          currentState={currentState}
          onApply={applyView}
          onSave={savedViews.save}
          onDelete={savedViews.remove}
          ownStaffId={staff?.id}
        />
      }
      actions={
        <>
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/sales/contacts/new')}>
              <Plus size={20} aria-hidden="true" />
              New Contact
            </Button>
          )}
          <SettingsButton
            label="Column settings"
            title="Choose the column order and which columns show"
            onClick={() => setSettingsOpen(true)}
          />
        </>
      }
      bulkBarOpen={canBulk && selected.size > 0}
      bulkBar={
        canBulk ? (
          <div className="record-action-bar fo-list-action-bar">
            <Button
              disabled={selectedTargets.length === 0}
              title={selectedTargets.length === 0 ? 'Tick a contact to email it.' : undefined}
              onClick={() =>
                window.open(
                  `mailto:${selectedTargets
                    .map((t) => rows.find((r) => r.profile.person_id === t.personId))
                    .map((r) => (r ? primaryEmail(r.person) : ''))
                    .filter(Boolean)
                    .join(',')}`,
                  '_self',
                )
              }
            >
              <Mail size={20} aria-hidden="true" />
              Send email
            </Button>
            <Button
              variant="danger"
              disabled={selectedTargets.length === 0}
              title={selectedTargets.length === 0 ? 'Tick a contact to delete it.' : undefined}
              onClick={() => setDeleting(selectedTargets)}
            >
              <Trash2 size={20} aria-hidden="true" />
              Delete
            </Button>
            <span className="text-secondary fo-bulk-hint">
              {selected.size > 0 ? `${selected.size} selected.` : ''}
            </span>
          </div>
        ) : undefined
      }
      filterRail={
          <div className="fo-advanced-search-body">
            <Select
              label="Company"
              options={companyOptions}
              placeholder="All companies"
              value={filters.company}
              onChange={(e) => setFilters({ ...filters, company: e.target.value })}
            />
          </div>
      }
      exportRows={exportContactRows}
      exportCount={total}
      exportColumns={visibleCols.map((key) => ({ key, header: COLUMN_HEADER[key] ?? key }))}
      exportFilename="contacts.csv"
    >
      {notice && (
        <p className="text-secondary fo-bulk-notice" role="status">
          {notice}
        </p>
      )}
      {savedViews.error && (
        <p className="form-error" role="alert">
          {savedViews.error}
        </p>
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />

      {showSkeleton ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading contacts" />
        </div>
      ) : loaded && total === 0 && !narrowed ? (
        <EmptyState
          icon={<ContactCardIcon size={64} aria-hidden="true" />}
          title="No contacts yet"
          hint="A contact is a person at one of your accounts: a hiring manager, a procurement lead, a day-to-day coordinator."
        >
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/sales/contacts/new')}>
              <Plus size={20} aria-hidden="true" />
              New Contact
            </Button>
          )}
        </EmptyState>
      ) : (
        <Table
          busy={loading}
          columns={columns}
          rows={pager.pageRows}
          rowKey={(r) => r.profile.person_id}
          sortKey={sort?.key ?? null}
          sortDir={sort?.dir ?? 'asc'}
          onSortChange={(key, dir) => setSort({ key, dir })}
          selectable={canBulk}
          selected={selected}
          onSelectionChange={changeSelection}
          onRowClick={(r) => openRecord(`/sales/contacts/${r.profile.person_id}`)}
          emptyIcon={<ContactCardIcon size={32} />}
          emptyText="No contact matches that search."
        />
      )}

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      {settingsOpen && (
        <ColumnSettingsDialog
          title="Column settings"
          hint="Drag a column to change where it sits, or untick it to hide it. Save a view to keep this arrangement."
          columns={COLUMN_DEFS}
          order={columnOrder}
          hidden={hiddenCols}
          onOrderChange={setColumnOrder}
          onToggle={(key) =>
            setHiddenCols(
              hiddenCols.includes(key)
                ? hiddenCols.filter((k) => k !== key)
                : [...hiddenCols, key],
            )
          }
          onReset={() => {
            setColumnOrder(ALL_COLUMN_KEYS);
            setHiddenCols([]);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {deleting && (
        <ContactDeleteDialog
          targets={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={(deleted, refused) => {
            setDeleting(null);
            setSelected(new Set());
            setNotice(
              refused === 0
                ? `${deleted} ${deleted === 1 ? 'contact' : 'contacts'} deleted.`
                : `${deleted} of ${deleted + refused} deleted. ${refused} left in place, because your role cannot remove them.`,
            );
            void load();
          }}
        />
      )}
    </ListPage>
  );
}
