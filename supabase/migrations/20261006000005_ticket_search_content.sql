-- Make the ticket id, code, title, description text and company searchable in the list and
-- in link suggestions. The description is HTML, so its tags are stripped before it enters
-- search_text; otherwise a search for "img" or "ticket" would match every ticket that has an
-- inline image. The raw HTML stays off the view; link suggestions get a 160-character
-- plain-text excerpt instead.
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
  lower(concat_ws(' ',
    t.id::text,
    t.display_code,
    t.subject,
    regexp_replace(coalesce(t.description, ''), '<[^>]*>', ' ', 'g'),
    c.name
  )) as search_text,
  left(btrim(regexp_replace(regexp_replace(coalesce(t.description, ''), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 160) as description_excerpt
from public.tickets t
left join public.companies c on c.id = t.company_id
left join public.staff a on a.id = t.assignee_id;

comment on view public.ticket_list is
  'Ticket rows with the company and assignee names, for server-side paging. security_invoker = on, so RLS on tickets, companies and staff still decides visibility.';

grant select on public.ticket_list to authenticated;
