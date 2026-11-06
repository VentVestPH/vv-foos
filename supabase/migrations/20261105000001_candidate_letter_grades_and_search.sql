-- Change requests from the 2026-11-05 Amir and John review.
--
-- Grades. The one-to-three star rating imported from Zoho is replaced by two
-- letter grades on the American A, B, C, D, F scale: one the sourcer gives and one
-- the manager gives, so a sourcer can learn from the manager's evaluation. The
-- star_grade column stays (no data is dropped and imports still write it), but
-- nothing in the app shows it any more. John confirmed on 2026-11-06 that the old
-- star rating was the sourcer's grade and that it converts as 3 stars = C,
-- 2 stars = D, 1 star = F, so the 335 existing ratings are copied into
-- sourcer_grade that way. manager_grade starts empty.
--
-- Intake and the Zoho importer still write star_grade. A trigger turns a new star
-- rating into a sourcer_grade when the person has none, so those candidates are not
-- left ungraded on screen.
--
-- A sourcer may still write only grade fields on a candidate profile, now
-- including sourcer_grade. manager_grade is not theirs to write.
--
-- Search. candidate_list.search_text covers name, title, employer and email
-- only, so a candidate could not be found by the requisitions they sit on.
-- requisition_search aggregates the title, job code and display code of EVERY
-- application the person has, not only the latest, so searching for any one
-- requisition finds everyone attached to it. New columns are appended at the
-- end so the view can be replaced in place.

alter table public.candidate_profiles
  add column if not exists sourcer_grade text,
  add column if not exists manager_grade text;

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_sourcer_grade_check,
  drop constraint if exists candidate_profiles_manager_grade_check;

alter table public.candidate_profiles
  add constraint candidate_profiles_sourcer_grade_check
    check (sourcer_grade in ('A', 'B', 'C', 'D', 'F')),
  add constraint candidate_profiles_manager_grade_check
    check (manager_grade in ('A', 'B', 'C', 'D', 'F'));

update public.candidate_profiles
set sourcer_grade = case star_grade when 3 then 'C' when 2 then 'D' when 1 then 'F' end
where star_grade is not null
  and sourcer_grade is null;

create or replace function public.fn_candidate_grade_guard()
returns trigger
language plpgsql
as $$
begin
  if public.get_my_role() = 'sourcer'
     and (to_jsonb(new) - 'star_grade' - 'grade_comment' - 'sourcer_grade')
         is distinct from (to_jsonb(old) - 'star_grade' - 'grade_comment' - 'sourcer_grade') then
    raise exception 'sourcer may update sourcer_grade and grade_comment only';
  end if;
  return new;
end $$;

create or replace function public.fn_candidate_star_to_letter()
returns trigger
language plpgsql
as $$
begin
  if new.star_grade is not null
     and new.sourcer_grade is null
     and (tg_op = 'INSERT' or new.star_grade is distinct from old.star_grade) then
    new.sourcer_grade := case new.star_grade when 3 then 'C' when 2 then 'D' when 1 then 'F' end;
  end if;
  return new;
end $$;

drop trigger if exists trg_candidate_profiles_star_to_letter on public.candidate_profiles;
create trigger trg_candidate_profiles_star_to_letter
  before insert or update of star_grade on public.candidate_profiles
  for each row execute function public.fn_candidate_star_to_letter();

create or replace view public.candidate_list
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
  ) as requisition_codes,
  cp.sourcer_grade,
  cp.manager_grade,
  (
    select lower(string_agg(concat_ws(' ', r.title, r.job_code, r.display_code), ' '))
    from public.applications a
    join public.requisitions r on r.id = a.requisition_id
    where a.person_id = cp.person_id
  ) as requisition_search
from public.candidate_profiles cp
join public.people p on p.id = cp.person_id
left join public.candidate_statuses cs on cs.id = cp.status_id
left join public.sources src on src.id = cp.source_id
left join public.staff sourcer on sourcer.id = cp.sourcer_id;

grant select on public.candidate_list to authenticated;
