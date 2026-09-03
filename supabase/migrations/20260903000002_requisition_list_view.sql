-- Server-side paging, filtering and sorting for the requisition list.
--
-- Same reasoning as candidate_list in 20260903000001: RequisitionListPage paged
-- every requisitions row, every requisition_owners row and every applications
-- row into the browser and filtered in JavaScript. Its filters straddle three
-- tables, so it cannot page server-side without a join: status, location and
-- opened_date live on requisitions, the company name on companies, and the
-- owner filter is a many-to-many through requisition_owners.
--
-- security_invoker = on for the same reason and with the same consequence: the
-- lookup joins must be LEFT, because under security_invoker an inner join to a
-- row the caller's RLS hides would drop the requisition rather than blank a
-- cell. The aggregates are lateral subqueries for the same reason, so a
-- requisition with no owners or no applications still appears.

drop view if exists public.requisition_list;

create view public.requisition_list
with (security_invoker = on) as
select
  r.id,
  r.display_code,
  r.job_code,
  r.title,
  r.status,
  r.company_id,
  c.name as company_name,
  r.location,
  r.employment_type,
  r.num_openings,
  r.opened_date,
  r.filled_date,
  r.is_published,
  r.created_at,
  r.updated_at,
  coalesce(o.owner_ids, '{}') as owner_ids,
  coalesce(o.owner_names, '{}') as owner_names,
  coalesce(a.application_count, 0) as application_count,
  lower(
    concat_ws(' ', r.display_code, r.job_code, r.title, c.name, r.location)
  ) as search_text
from public.requisitions r
left join public.companies c on c.id = r.company_id
left join lateral (
  select
    array_agg(ro.staff_id) as owner_ids,
    array_agg(s.full_name order by s.full_name) filter (where s.full_name is not null) as owner_names
  from public.requisition_owners ro
  left join public.staff s on s.id = ro.staff_id
  where ro.requisition_id = r.id
) o on true
left join lateral (
  select count(*) as application_count
  from public.applications ap
  where ap.requisition_id = r.id
) a on true;

comment on view public.requisition_list is
  'Requisition list rows with company name, owner arrays and an application count, for server-side paging. security_invoker = on, so RLS on the underlying tables still decides visibility.';

grant select on public.requisition_list to authenticated;

create index if not exists idx_requisitions_status on public.requisitions (status);
create index if not exists idx_requisitions_company on public.requisitions (company_id);
create index if not exists idx_requisitions_opened_date on public.requisitions (opened_date);
create index if not exists idx_requisition_owners_staff on public.requisition_owners (staff_id);
