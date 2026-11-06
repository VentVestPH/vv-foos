-- The candidate table on a requisition drops its Shortlisted and Rank columns and
-- shows the sourcer grade, sourcer name and manager grade instead
-- (2026-11-05 review). The columns come from candidate_profiles and are appended
-- at the end of the view, so it is replaced in place. is_shortlisted and rank stay
-- in the view and the tables; only the screen stops showing them.

create or replace view public.application_pipeline
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
  ) as stage_rank,
  cp.sourcer_grade,
  cp.manager_grade,
  sourcer.full_name as sourcer_name
from public.applications a
join public.people p on p.id = a.person_id
left join public.sources s on s.id = a.source_id
left join public.candidate_profiles cp on cp.person_id = a.person_id
left join public.staff sourcer on sourcer.id = cp.sourcer_id
left join public.application_views av
  on av.application_id = a.id
 and av.staff_id = auth.uid();

grant select on public.application_pipeline to authenticated;
