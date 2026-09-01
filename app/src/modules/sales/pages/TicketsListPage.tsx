import { useEffect, useMemo, useState } from 'react';
import { db as supabase } from '../db';
import { StatusBadge } from '../../../components/ui/Badge';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { TaleoPager, usePagination } from '../../../components/ui/TaleoPager';
import { TaleoPlaceholderAction } from '../../../shell/TaleoPlaceholder';
import { TicketIcon } from '../../../shell/icons';
import { useCompanyOptions, useStaffList } from '../hooks';
import { fmtDate, type Ticket } from '../lib';

export function TicketsListPage() {
  const [loading, setLoading] = useState(true);
  const { staffName } = useStaffList();
  const { companyName } = useCompanyOptions();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
      setLoading(true);
    supabase
      .from('tickets')
      .select('*')
      .then(({ data }) => {
        if (!cancelled) {
            setTickets(data ?? []);
            setLoading(false);
          }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      `${t.display_code} ${t.subject}`.toLowerCase().includes(q),
    );
  }, [tickets, search]);

  const columns: TableColumn<Ticket>[] = [
    { key: 'display_code', header: 'Code', sortable: true },
    { key: 'subject', header: 'Subject', sortable: true, capped: true },
    {
      key: 'company',
      header: 'Company',
      render: (t) => companyName(t.company_id),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (t) => t.priority ?? '—',
    },
    {
      key: 'assignee',
      header: 'Assignee',
      render: (t) => staffName(t.assignee_id),
    },
    {
      key: 'sla_due_at',
      header: 'SLA due',
      render: (t) => fmtDate(t.sla_due_at),
    },
  ];

  const pager = usePagination(visible);

  return (
    <ListPage
      title="Tickets: Home"
      icon={<TicketIcon size={40} />}
      description="Tickets are the customer support and account issues your team is tracking in Front Office OS."
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search tickets…"
      actions={
        <TaleoPlaceholderAction
          label="New Ticket"
          variant="primary"
          detail="Ticket creation isn't implemented yet — it arrives with the Customer Success module."
        />
      }
    >
      <TaleoPager
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
        emptyText={loading ? 'Loading…' : "No tickets. Ticket workflows arrive with the CS module."}
      />

      <TaleoPager
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
