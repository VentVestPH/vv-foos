-- Server-side paging for the ticket list.
--
-- Last of the six list screens. The simplest of them: the only filter is a free
-- text search over display_code and subject, and the old code paged every
-- tickets row into the browser to serve it. The view exists mainly for the
-- company and assignee names, which the old screen looked up through
-- client-side maps built from separate full-table reads.
--
-- security_invoker = on, and both name joins are LEFT so a ticket whose company
-- or assignee row the caller's RLS hides keeps its row and loses only the label.

drop view if exists public.ticket_list;

create view public.ticket_list
with (security_invoker = on) as
select
  t.id,
  t.display_code,
  t.subject,
  t.status,
  t.priority,
  t.company_id,
  c.name as company_name,
  t.person_id,
  t.assignee_id,
  a.full_name as assignee_name,
  t.sla_due_at,
  t.resolved_at,
  lower(concat_ws(' ', t.display_code, t.subject, c.name)) as search_text
from public.tickets t
left join public.companies c on c.id = t.company_id
left join public.staff a on a.id = t.assignee_id;

comment on view public.ticket_list is
  'Ticket rows with the company and assignee names, for server-side paging. security_invoker = on, so RLS on tickets, companies and staff still decides visibility.';

grant select on public.ticket_list to authenticated;

create index if not exists idx_tickets_status on public.tickets (status);
create index if not exists idx_tickets_assignee on public.tickets (assignee_id);
