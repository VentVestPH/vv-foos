import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Database } from '../../../lib/database.types';
import { TICKET_STATUSES, type TicketStatus } from '../../../lib/database.types';
import { supabase } from '../../../lib/supabase';
import { useLatestOnly } from '../../../lib/useLatestOnly';
import { useSubmittedSearch } from '../../../lib/quickSearch';
import { Badge, StatusBadge } from '../../../components/ui/Badge';
import { ListPage } from '../../../components/ui/ListPage';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Pager } from '../../../components/ui/Pager';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useMinimumVisible } from '../../../hooks/useMinimumVisible';
import { useViewPref } from '../../../hooks/useViewPref';
import { KanbanSkeleton } from '../../../components/ui/KanbanSkeleton';
import { SegmentedToggle } from '../../../components/ui/SegmentedToggle';
import { Columns3 as KanbanIcon, Plus, Table2 as TableIcon, Ticket as TicketIcon } from 'lucide-react';
import { KanbanBoard } from '../../../components/ui/KanbanBoard';
import { fmtDate } from '../lib';
import { EMPTY_CELL } from '../../../lib/format';
import { Button } from '../../../components/ui/Button';
import { TicketDialog } from '../components/TicketDialog';
import { ticketSearchHints } from '../../../lib/searchHints';
import { useCanEditCrm } from '../hooks';

const TICKET_PAGE_SIZE = 20;
const TICKET_KANBAN_PAGE_SIZE = 20;
const TICKET_VIEWS = ['table', 'kanban'] as const;

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

type TicketListRow = Omit<Database['public']['Views']['ticket_list']['Row'], 'search_text' | 'description_excerpt'>;
type TicketView = 'table' | 'kanban';

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
  closed: 'Closed',
};

function TicketsKanban({
  lanes,
  onOpen,
  onMove,
  canMove,
}: {
  lanes: Map<TicketStatus, { cards: TicketListRow[]; total: number }>;
  onOpen: (ticketId: string) => void;
  onMove: (ticketId: string, status: TicketStatus) => void;
  canMove: boolean;
}) {
  const stages = TICKET_STATUSES.map((status) => ({ key: status, label: TICKET_STATUS_LABEL[status] }));
  const cards = [...lanes.entries()].flatMap(([status, lane]) => lane.cards.map((ticket) => ({
    id: ticket.id,
    stage: status,
    content: (
      <div className="sales-kanban-card">
        <span className="sales-kanban-card-code">
          <button
            type="button"
            className="sales-kanban-card-open"
            aria-label={`Open ${ticket.display_code}: ${ticket.subject}`}
            onClick={() => onOpen(ticket.id)}
          >
            {ticket.display_code}
          </button>
          {ticket.priority && <>{' '}<Badge tone={ticket.priority === 'urgent' || ticket.priority === 'high' ? 'warning' : 'neutral'}>{ticket.priority}</Badge></>}
        </span>
        <span className="sales-kanban-card-name">{ticket.subject}</span>
        <span>{ticket.company_name ?? 'No account linked'}</span>
        <span>{[ticket.assignee_name ?? 'Unassigned', ticket.sla_due_at ? `SLA ${fmtDate(ticket.sla_due_at)}` : null].filter(Boolean).join(' · ')}</span>
      </div>
    ),
  })));
  const stageCounts = Object.fromEntries([...lanes].map(([status, lane]) => [status, lane.total]));

  return (
    <div className="sales-ticket-board">
      <KanbanBoard
        stages={stages}
        cards={cards}
        stageCounts={stageCounts}
        disabled={!canMove}
        onMove={(ticketId, status) => onMove(ticketId, status as TicketStatus)}
      />
    </div>
  );
}

function ticketLikeLiteral(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

export function TicketsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const [tickets, setTickets] = useState<TicketListRow[]>([]);
  const [lanes, setLanes] = useState<Map<TicketStatus, { cards: TicketListRow[]; total: number }>>(new Map());
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const { view, setView } = useViewPref<TicketView>('foos.tickets.view', TICKET_VIEWS, 'table');
  const dialogTicketId = searchParams.get('id');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const canEdit = useCanEditCrm();
  const {
    input: searchInput,
    setInput: setSearchInput,
    term: search,
    submit: submitSearch,
  } = useSubmittedSearch();

  const beginLoad = useLatestOnly();
  const showSkeleton = useMinimumVisible(loading);

  const openTicket = useCallback((ticketId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('id', ticketId);
      return next;
    });
  }, [setSearchParams]);

  const closeTicket = useCallback(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('id');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const load = useCallback(async (silent = false) => {
    const isCurrent = beginLoad();
    if (!silent) setLoading(true);
    setError(null);
    try {
      const term = search.trim().toLowerCase();
      const sortColumn = sort ? TICKET_SORT_COLUMNS[sort.key] : undefined;
      if (view === 'kanban') {
        const results = await Promise.all(TICKET_STATUSES.map(async (status) => {
          let q = supabase.from('ticket_list').select(TICKET_VIEW_COLUMNS, { count: 'exact' }).eq('status', status);
          if (term) q = q.ilike('search_text', `%${ticketLikeLiteral(term)}%`);
          q = sortColumn
            ? q.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
            : q.order('display_code', { ascending: true });
          const start = page * TICKET_KANBAN_PAGE_SIZE;
          const { data, count, error: queryError } = await q
            .order('id', { ascending: true })
            .range(start, start + TICKET_KANBAN_PAGE_SIZE - 1);
          if (queryError) throw new Error(queryError.message);
          return [status, { cards: data ?? [], total: count ?? 0 }] as const;
        }));
        if (!isCurrent()) return;
        const nextLanes = new Map<TicketStatus, { cards: TicketListRow[]; total: number }>(results);
        setLanes(nextLanes);
        setTotal([...nextLanes.values()].reduce((sum, lane) => sum + lane.total, 0));
      } else {
        let q = supabase.from('ticket_list').select(TICKET_VIEW_COLUMNS, { count: 'exact' });
        if (term) q = q.ilike('search_text', `%${ticketLikeLiteral(term)}%`);
        q = sortColumn
          ? q.order(sortColumn, { ascending: sort?.dir === 'asc', nullsFirst: false })
          : q.order('display_code', { ascending: true });
        const start = page * TICKET_PAGE_SIZE;
        const { data, count, error: queryError } = await q
          .order('id', { ascending: true })
          .range(start, start + TICKET_PAGE_SIZE - 1);
        if (queryError) throw new Error(queryError.message);
        if (!isCurrent()) return;
        setTickets(data ?? []);
        setTotal(count ?? 0);
      }
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [search, sort, page, view, beginLoad]);

  const moveTicket = useCallback((ticketId: string, status: TicketStatus) => {
    if (!canEdit) return;
    const current = [...lanes.values()].flatMap((lane) => lane.cards).find((ticket) => ticket.id === ticketId);
    if (!current || current.status === status) return;
    setLanes((existing) => {
      const next = new Map(existing);
      for (const [key, lane] of next) {
        if (lane.cards.some((ticket) => ticket.id === ticketId)) {
          next.set(key, { cards: lane.cards.filter((ticket) => ticket.id !== ticketId), total: lane.total - 1 });
        }
      }
      const target = next.get(status) ?? { cards: [], total: 0 };
      next.set(status, { cards: [{ ...current, status }, ...target.cards], total: target.total + 1 });
      return next;
    });
    void (async () => {
      const { error: updateError } = await supabase.from('tickets').update({ status }).eq('id', ticketId);
      if (updateError) setError(`Ticket status could not be updated: ${updateError.message}`);
      void load(true);
    })();
  }, [canEdit, lanes, load]);

  useEffect(() => {
    setPage(0);
  }, [search, sort, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: TableColumn<TicketListRow>[] = [
    { key: 'display_code', header: 'Code' },
    { key: 'subject', header: 'Subject', render: (ticket) => (
      <button type="button" className="link-btn" onClick={(event) => { event.stopPropagation(); openTicket(ticket.id); }}>
        {ticket.subject}
      </button>
    ) },
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

  const kanbanPageCount = Math.max(1, ...[...lanes.values()].map((lane) => Math.ceil(lane.total / TICKET_KANBAN_PAGE_SIZE)));
  const activePageSize = view === 'kanban' ? TICKET_KANBAN_PAGE_SIZE : TICKET_PAGE_SIZE;
  const pageCount = view === 'kanban' ? kanbanPageCount : Math.max(1, Math.ceil(total / TICKET_PAGE_SIZE));
  const pager = {
    page,
    setPage,
    pageCount,
    total,
    from: total === 0 ? 0 : page * activePageSize + 1,
    to: Math.min(total, (page + 1) * activePageSize),
    pageRows: tickets,
  };

  return (
    <ListPage
      breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Tickets' }]}
      flush
      title="Tickets"
      icon={<TicketIcon size={32} />}
      description="Tickets are the customer support and account issues your team is tracking in Front Office OS."
      search={searchInput}
      onSearchChange={setSearchInput}
      onSearchSubmit={submitSearch}
      searchPlaceholder="Search tickets…"
      searchHints={ticketSearchHints}
      actions={
        <>
          {canEdit && <Button variant="primary" onClick={() => setCreateDialogOpen(true)}><Plus size={20} /> New Ticket</Button>}
        </>
      }
    >
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="fo-list-toolbar">
        <SegmentedToggle
          ariaLabel="Ticket view"
          className="sales-ticket-view-toggle"
          value={view}
          onChange={(next) => {
            setView(next);
          }}
          options={[
            { value: 'table', label: '', title: 'Table view', icon: <TableIcon size={20} aria-hidden="true" /> },
            { value: 'kanban', label: '', title: 'Kanban view', icon: <KanbanIcon size={20} aria-hidden="true" /> },
          ]}
        />
        <Pager
        from={pager.from}
        to={pager.to}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        onPage={pager.setPage}
        {...(view === 'kanban' ? { countLabel: `Page ${pager.page + 1} of ${pager.pageCount}` } : {})}
        />
      </div>

      {showSkeleton && view === 'table' ? (
        <div className="fo-skeleton-card">
          <Skeleton rows={8} label="Loading tickets" />
        </div>
      ) : showSkeleton ? (
        <div className="sales-ticket-board">
          <KanbanSkeleton
            label="Loading tickets by status"
            stages={TICKET_STATUSES.map((status) => ({ key: status, label: TICKET_STATUS_LABEL[status] }))}
          />
        </div>
      ) : view === 'kanban' ? (
        <TicketsKanban lanes={lanes} onOpen={openTicket} onMove={moveTicket} canMove={canEdit} />
      ) : (
        <Table
          busy={loading}
          columns={columns}
          rows={pager.pageRows}
          rowKey={(t) => t.id}
          sortKey={sort?.key ?? null}
          sortDir={sort?.dir ?? 'asc'}
          onSortChange={(key, dir) => setSort({ key, dir })}
          onRowClick={(ticket) => openTicket(ticket.id)}
          emptyIcon={<TicketIcon size={32} />}
          emptyText="No tickets found."
        />
      )}

      {(createDialogOpen || dialogTicketId) && <TicketDialog
        ticketId={dialogTicketId}
        onClose={() => { closeTicket(); setCreateDialogOpen(false); }}
        onSaved={() => { void load(true); }}
      />}
    </ListPage>
  );
}
