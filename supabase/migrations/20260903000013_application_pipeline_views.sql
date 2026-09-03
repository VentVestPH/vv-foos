-- Bound the application pipeline board, the way 20260903000003 bounded the deal board.
--
-- ApplicationPipeline loaded every application on a requisition with fetchAllRows,
-- then fetched every person by id in chunks of 200, then rendered one card or one
-- table row each. Measured on the busiest requisition, which holds 1,300
-- applications: 5.4 MB over 46 REST requests, 27,662 DOM nodes for the table view
-- and 1,300 cards on the board. 136 requisitions hold more than 200 applications,
-- so this is the ordinary case for a real desk rather than an outlier.
--
-- Two views, because the board needs two different things and one query cannot give
-- both without over-fetching.
--
-- application_pipeline is one row per application, carrying the candidate's name and
-- the source label the board renders, so the separate person fetch disappears
-- entirely. stage_rank is the row's position within its own stage, which lets the
-- board ask for the first N of every stage in a single request rather than one
-- request per column.
--
-- application_stage_summary is the per-stage total and the caller's unviewed count.
-- These have to be aggregated over every application in the stage, not just the N
-- the board loaded, because a count computed from a truncated set is exactly the
-- defect U1.3 found on the requisition list: unviewed badges wrong on 1,859 of 2,002
-- requisitions because they were computed from 1,000 of 14,008 applications.
--
-- Both are security_invoker, so auth.uid() is the caller and RLS on applications,
-- people and application_views still decides what is visible. unviewed repeats the
-- client's definition exactly: no application_views row for this staff member, or one
-- whose last_viewed_at predates the application's stage_changed_at.

drop view if exists public.application_pipeline;
drop view if exists public.application_stage_summary;

create view public.application_pipeline
with (security_invoker = on) as
select
  a.id,
  a.display_code,
  a.requisition_id,
  a.person_id,
  a.stage,
  a.next_step,
  a.rejection_reason,
  a.is_shortlisted,
  a.rank,
  a.source_id,
  a.applied_at,
  a.stage_changed_at,
  p.first_name,
  p.last_name,
  trim(both ' ' from concat_ws(' ', p.first_name, p.last_name)) as candidate_name,
  s.name as source_name,
  (av.last_viewed_at is null or av.last_viewed_at < a.stage_changed_at) as unviewed,
  row_number() over (
    partition by a.requisition_id, a.stage
    order by a.applied_at desc nulls last, a.id
  ) as stage_rank
from public.applications a
join public.people p on p.id = a.person_id
left join public.sources s on s.id = a.source_id
left join public.application_views av
  on av.application_id = a.id
 and av.staff_id = auth.uid();

comment on view public.application_pipeline is
  'One row per application with the candidate name, source label and the caller''s unviewed flag, plus stage_rank so a board can take the first N of every stage in one request. security_invoker = on.';

create view public.application_stage_summary
with (security_invoker = on) as
select
  a.requisition_id,
  a.stage,
  count(*) as application_count,
  count(*) filter (
    where av.last_viewed_at is null or av.last_viewed_at < a.stage_changed_at
  ) as unviewed_count
from public.applications a
left join public.application_views av
  on av.application_id = a.id
 and av.staff_id = auth.uid()
group by a.requisition_id, a.stage;

comment on view public.application_stage_summary is
  'Per requisition and stage: how many applications there are and how many the caller has not seen since the stage last changed. Aggregated over every application in the stage, never over the page the board loaded. security_invoker = on.';

grant select on public.application_pipeline to authenticated;
grant select on public.application_stage_summary to authenticated;

create index if not exists idx_applications_requisition_stage
  on public.applications (requisition_id, stage);
create index if not exists idx_applications_requisition_applied
  on public.applications (requisition_id, applied_at desc, id);
