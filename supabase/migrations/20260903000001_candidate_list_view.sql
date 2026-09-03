-- Server-side paging, filtering and sorting for the candidate list.
--
-- Why this exists: CandidateListPage used fetchAllRows to pull every
-- candidate_profiles row, every applications row and every requisitions row
-- into the browser, then filtered and paginated in JavaScript. That is fine at
-- the 75-row scale the importer was built against. The live Zoho Recruit org
-- holds over 70,200 candidates, measured 2026-09-03, at which point opening the
-- list would mean roughly 71 requests to page the profiles plus 351 to page the
-- people, before the first row is painted, and the whole set held in memory.
--
-- The list cannot page server-side without a join, because its filters straddle
-- two tables: status, grade, source, sourcer and initial_date live on
-- candidate_profiles, while the free-text search covers first and last name and
-- the email addresses on people, and the default sort is by name. PostgREST can
-- filter an embedded resource, but it cannot OR a condition across the parent
-- and the embedded table, which is exactly what the search box does.
--
-- security_invoker = on is load-bearing, matching the dash views: without it the
-- view would run as its owner and every RLS policy on candidate_profiles and
-- people would be bypassed. With it, a sourcer still sees only what the base
-- table policies allow, and the view adds no privilege of its own.
--
-- search_text is denormalised into the view rather than computed in the client
-- so that one PostgREST request can filter, sort, page and return an exact
-- count. It is lowercased here so callers use ilike without a functional index
-- mismatch.

-- The lookup joins are LEFT, not INNER, and that is a correctness requirement
-- rather than a style choice. Under security_invoker the joined tables' own RLS
-- applies to the caller, so an INNER join to candidate_statuses, sources or
-- staff would silently drop every candidate whose lookup row the caller cannot
-- read. A LEFT join yields a null label instead, which is a blank cell rather
-- than a missing candidate.

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
  ) as has_resume
from public.candidate_profiles cp
join public.people p on p.id = cp.person_id
left join public.candidate_statuses cs on cs.id = cp.status_id
left join public.sources src on src.id = cp.source_id
left join public.staff sourcer on sourcer.id = cp.sourcer_id;

comment on view public.candidate_list is
  'Candidate list rows joined to people, for server-side paging. security_invoker = on, so RLS on candidate_profiles and people still decides visibility.';

grant select on public.candidate_list to authenticated;

-- Indexes for the filters the list actually issues. A view cannot be indexed,
-- so these sit on the base tables. Each one corresponds to a control in the
-- filter rail; nothing speculative is added here.
create index if not exists idx_candidate_profiles_status on public.candidate_profiles (status_id);
create index if not exists idx_candidate_profiles_source on public.candidate_profiles (source_id);
create index if not exists idx_candidate_profiles_sourcer on public.candidate_profiles (sourcer_id);
create index if not exists idx_candidate_profiles_initial_date on public.candidate_profiles (initial_date);
create index if not exists idx_candidate_profiles_star_grade on public.candidate_profiles (star_grade);

-- The default sort is last name then first name, and the name columns are also
-- what the two name filters match against.
create index if not exists idx_people_last_first on public.people (last_name, first_name);
