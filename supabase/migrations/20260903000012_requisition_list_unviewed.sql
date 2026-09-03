-- Move the requisition list's unviewed badge count into the view.
--
-- RequisitionListPage computed it in the browser: for the 20 requisitions on the
-- page it fetched their applications with
--
--   .from('applications').select('id, requisition_id, stage_changed_at')
--     .in('requisition_id', reqIds)
--
-- and then counted, per requisition, the applications with no application_views
-- row or one older than stage_changed_at.
--
-- That .in() narrows to 20 requisitions and looks bounded, which is exactly the
-- blind spot scripts/check-unbounded-queries.mjs documents. It has no .range()
-- and no .limit(), so PostgREST caps it at max_rows = 1000. The 20 most recently
-- created requisitions hold 2,028 applications after the Zoho import, so the
-- badge was computed from under half of them, and because the query has no
-- ORDER BY, which half is not even stable between runs.
--
-- U1.3 fixed this for the application count by moving it into this view and left
-- the unviewed count in the browser, where the same defect survived. Counting it
-- here is correct rather than merely faster: the view is security_invoker, so
-- auth.uid() is the caller and RLS on applications and application_views still
-- decides what is counted. It also removes two round-trips per page and the
-- 200-id chunking loop that fetched the views.
--
-- Definition of unviewed, unchanged from the client: no application_views row for
-- this staff member, or one whose last_viewed_at predates the application's
-- stage_changed_at. A requisition with no applications counts 0, not null, so the
-- badge component never has to handle a null.

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
  coalesce(o.owner_ids, '{}'::uuid[]) as owner_ids,
  coalesce(o.owner_names, '{}'::text[]) as owner_names,
  coalesce(a.application_count, 0::bigint) as application_count,
  coalesce(u.unviewed_count, 0::bigint) as unviewed_count,
  lower(concat_ws(' '::text, r.display_code, r.job_code, r.title, c.name, r.location)) as search_text
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
) a on true
left join lateral (
  select count(*) as unviewed_count
  from public.applications ap
  left join public.application_views av
    on av.application_id = ap.id
   and av.staff_id = auth.uid()
  where ap.requisition_id = r.id
    and (av.last_viewed_at is null or av.last_viewed_at < ap.stage_changed_at)
) u on true;

comment on view public.requisition_list is
  'Requisition list rows with company name, owner arrays, an application count and the caller''s unviewed count, for server-side paging. security_invoker = on, so auth.uid() is the caller and RLS on the underlying tables still decides visibility.';

grant select on public.requisition_list to authenticated;

create index if not exists idx_application_views_staff_app
  on public.application_views (staff_id, application_id);
