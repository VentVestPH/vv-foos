-- Server-side paging for the company list.
--
-- Fifth in the series. Two of this screen's filters cannot be expressed against
-- the base table from the client the way the old code did it: the type filter
-- tests membership of the companies.types array, and the location filter matches
-- against city, state and country joined into one label. Both become real
-- columns here, so the filter runs in Postgres rather than over a fully
-- downloaded table.
--
-- security_invoker = on, and the owner join is LEFT so that a company whose
-- owner row the caller's RLS hides keeps its row and loses only the owner name.

drop view if exists public.company_list;

create view public.company_list
with (security_invoker = on) as
select
  c.id,
  c.name,
  c.types,
  c.website,
  c.city,
  c.state,
  c.country,
  c.phone,
  c.owner_id,
  o.full_name as owner_name,
  c.is_test,
  c.created_at,
  c.updated_at,
  nullif(
    concat_ws(', ', nullif(c.city, ''), nullif(c.state, ''), nullif(c.country, '')),
    ''
  ) as location_text,
  lower(concat_ws(' ', c.name, c.website)) as search_text
from public.companies c
left join public.staff o on o.id = c.owner_id;

comment on view public.company_list is
  'Company rows with the owner name, a composed location label and a search text, for server-side paging. security_invoker = on, so RLS on companies and staff still decides visibility.';

grant select on public.company_list to authenticated;

create index if not exists idx_companies_owner on public.companies (owner_id);
create index if not exists idx_companies_name on public.companies (name);
