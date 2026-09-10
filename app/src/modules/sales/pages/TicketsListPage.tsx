import { useCallback, useEffect, useState } from 'react';
import type { Database } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { StatusBadge } from '../../../components/ui/Badge';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { PlaceholderAction } from '../../../shell/Placeholder';
import { Ticket as TicketIcon } from 'lucide-react';
import { fmtDate } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';

const TICKET_PAGE_SIZE = 20;

const TICKET_VIEW_COLUMNS =
  'id, display_code, subject, status, priority, company_id, company_name, person_id, assignee_id, assignee_name, sla_due_at, resolved_at';

const TICKET_SORT_COLUMNS: Record<string, string> = {
  display_code: 'display_code',
  subject: 'subject',
  company: 'company_name',
  status: 'status',
  priority: 'priority',
  assignee: 'assignee_name',
  sla_due_at: 'sla_due_at',
  resolved_at: 'resolved_at',
};

type TicketListRow = Omit<Database['public']['Views']['ticket_list']['Row'], 'search_text'>;

function ticketLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

export function TicketsListPage() {
  const [loading, setLoading] = useState(true);

  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [search, setSearch] = useState('');

  const beginLoad = useLatestOnly();

  const load = useCallback(async () => {
    const isCurrent = beginLoad();
    setLoading(true);
    try {
      let q = supabase.from('ticket_list').select(TICKET_VIEW_COLUMNS, { count: 'exact' });
      const term = search.trim().toLowerCase();
      if (term) q = q.ilike('search_text', `%${ticketLikeLiteral(term)}%`);
      const sortColumn = sort ? TICKET_SORT_COLUMNS[sort.key] : undefined;
      q = sortColumn
        ? q.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
        : q.order('display_code', { ascending: true });
      const start = page * TICKET_PAGE_SIZE;
      const { data, count, error } = await q
        .order('id', { ascending: true })
        .range(start, start + TICKET_PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      if (!isCurrent()) return;
      setTickets(data ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [search, sort, page, beginLoad]);

  useEffect(() => {
    setPage(0);
  }, [search, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<TicketListRow>[] = [
    { key: 'display_code', header: 'Code', sortable: true },
    { key: 'subject', header: 'Subject', sortable: true, capped: true },
    {
      key: 'company',
      header: 'Company',
      render: (t) => t.company_name ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => t.priority ?? EMPTY_CELL,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (t) => t.assignee_name ?? '',
    },
    {
      key: 'sla_due_at',
      header: 'SLA due',
      render: (t) => fmtDate(t.sla_due_at),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * TICKET_PAGE_SIZE + 1,
    to: Math.min(total, (page + 1) * TICKET_PAGE_SIZE),
    pageRows: tickets,
  };

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Tickets' }]}
      title="Tickets"
      icon={<TicketIcon size={32} />}
      description="Tickets are the customer support and account issues your team is tracking in Front Office OS."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search tickets…"
      actions={
        <PlaceholderAction
          label="New Ticket"
          variant="primary"
          detail="Ticket creation isn't implemented yet — it arrives with the Customer Success module."
        />
      }
    >
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
        rowKey={(t) => t.id}
        sortKey={sort?.key ?? null}
        sortDir={sort?.dir ?? 'asc'}
        onSortChange={(key, dir) => setSort({ key, dir })}
        emptyText="No tickets. Ticket workflows arrive with the CS module."
      />

      <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
      />
      <div className="sales-panel-note">
        Read-only in v1 — the Customer Success module adds create, transitions,
        and SLA handling later.
      </div>
    </ListPage>
  );
}
