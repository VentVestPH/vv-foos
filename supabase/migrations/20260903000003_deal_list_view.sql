-- Server-side paging for the deal list, and bounded columns for the kanban.
--
-- Third in the series after candidate_list and requisition_list, and the one
-- with a different shape: the deal screen defaults to a kanban, which renders
-- every card grouped by stage. Paging does not apply to a kanban directly, so
-- the board fetches a bounded number of cards per stage together with an exact
-- per-stage count, and says how many it is not showing. A column holding a
-- thousand cards was never usable; this makes that explicit rather than slow.
--
-- The deal filters are all columns on deals itself, so the view exists for the
-- display names and the search text rather than for the filters. security_invoker
-- and LEFT joins for the same reasons as the other two: an inner join to a
-- company or staff row the caller's RLS hides would drop the deal instead of
-- blanking a cell.

drop view if exists public.deal_list;

create view public.deal_list
with (security_invoker = on) as
select
  d.id,
  d.display_code,
  d.name,
  d.stage,
  d.company_id,
  c.name as company_name,
  d.primary_contact_id,
  d.owner_id,
  o.full_name as owner_name,
  d.value,
  d.currency,
  d.probability,
  d.expected_close,
  d.lost_reason,
  d.is_test,
  d.created_at,
  d.updated_at,
  lower(concat_ws(' ', d.display_code, d.name, c.name)) as search_text
from public.deals d
left join public.companies c on c.id = d.company_id
left join public.staff o on o.id = d.owner_id;

comment on view public.deal_list is
  'Deal rows with company and owner names, for server-side paging and a bounded kanban. security_invoker = on, so RLS on deals, companies and staff still decides visibility.';

grant select on public.deal_list to authenticated;

create index if not exists idx_deals_stage on public.deals (stage);
create index if not exists idx_deals_owner on public.deals (owner_id);
create index if not exists idx_deals_updated_at on public.deals (updated_at desc);
