-- The Requisitions column on the candidate list was the one column with no
-- sort, because the codes were assembled in the browser: the page read the 20
-- visible people, then their applications, then those requisitions, and joined
-- them in JavaScript. Postgres cannot order by something the client computes,
-- so clicking the header would have re-run the default sort and looked broken.
--
-- Klent asked for it on 2026-09-10, so the aggregate moves into the view. It is
-- a correlated subquery rather than a join with a group by, to keep every other
-- column and the exact count unchanged and to avoid multiplying rows.
--
-- Measured before writing it, on the local stack with 73,023 candidate_profiles
-- and 86,163 applications: an unfiltered `order by requisition_codes` over the
-- whole set is 210.734 ms, using idx_applications_person and requisitions_pkey.
-- Filtered sorts are cheaper. That is inside a page load, so this is not paid
-- for with a materialised column that would then need refreshing.
--
-- The list page still builds its displayed chips from its own applications read,
-- because that read also feeds the CSV export path. The two agree because both
-- derive from the same rows, and dropping the client join is a separate change.
--
-- Everything else about the view is unchanged, including security_invoker = on
-- and the LEFT joins to the lookup tables. The reasons for both are in
-- 20260903000001_candidate_list_view.sql and still apply.

drop view if exists public.candidate_list;

create view public.candidate_list
with (security_invoker = on) as
select
  cp.person_id,
  p.first_name,
  p.middle_name,
  p.last_name,
  nullif(trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)), '') as full_name,
  p.emails,
  p.city,
  p.state,
  p.country,
  p.updated_at as person_updated_at,
  cp.status_id,
  cp.star_grade,
  cp.grade_comment,
  cp.current_title,
  cp.current_employer,
  cp.initial_date,
  cp.source_id,
  cp.sourcer_id,
  cp.do_not_contact,
  lower(
    concat_ws(
      ' ',
      p.first_name,
      p.middle_name,
      p.last_name,
      cp.current_title,
      cp.current_employer,
      (
        select string_agg(entry ->> 'address', ' ')
        from jsonb_array_elements(
               case
                 when jsonb_typeof(p.emails) = 'array' then p.emails
                 else '[]'::jsonb
               end
             ) as entry
      )
    )
  ) as search_text,
  cs.label as status_label,
  src.name as source_name,
  sourcer.full_name as sourcer_name,
  exists (
    select 1
    from public.attachments a
    where a.parent_type = 'person'
      and a.parent_id = cp.person_id
      and a.kind = 'resume'
  ) as has_resume,
  (
    select string_agg(r.display_code, ', ' order by r.display_code)
    from public.applications a
    join public.requisitions r on r.id = a.requisition_id
    where a.person_id = cp.person_id
  ) as requisition_codes
from public.candidate_profiles cp
join public.people p on p.id = cp.person_id
left join public.candidate_statuses cs on cs.id = cp.status_id
left join public.sources src on src.id = cp.source_id
left join public.staff sourcer on sourcer.id = cp.sourcer_id;

comment on view public.candidate_list is
  'Candidate list rows joined to people, for server-side paging. security_invoker = on, so RLS on candidate_profiles and people still decides visibility. requisition_codes is a correlated aggregate so the Requisitions column can be sorted server-side.';

grant select on public.candidate_list to authenticated;
