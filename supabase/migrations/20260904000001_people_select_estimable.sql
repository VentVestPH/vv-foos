-- Make people_select and candidate_profiles_select estimable, so paging the
-- candidate list past page one stops seq-scanning and sorting 72,917 rows.
--
-- Both policies were opaque to the planner in different ways, and the effect
-- compounded. people_select was `can_read_person(id)`, a plpgsql security-definer
-- function taking the row as an argument, which the planner cannot see inside and
-- so estimates with a default selectivity. candidate_profiles_select was an OR of
-- two comparisons against `(select get_my_role())`, whose value is unknown at plan
-- time, so it too fell back to defaults and estimated 801 visible rows out of
-- 72,917. Together they made the candidate_list join estimate 267 rows against
-- 72,917 actual, a 273x underestimate, which is the same 273 that PostgREST's
-- count=planned reports.
--
-- What that cost, measured under RLS as a recruiter before this migration:
--
--   limit 20 offset 0        3 ms      an incremental sort over idx_people_last_first
--   limit 20 offset 20     751 ms      seq scan on candidate_profiles, top-N heapsort
--   limit 20 offset 200    736 ms      of all 72,917 rows, every time
--   the same, seqscan off  2.9 ms      so the index path was always there
--   exact count          2,026 ms      PostgREST's materialised CTE, all rows
--
-- The bad estimate made the index path look expensive (cost 136,619) and the seq
-- scan look cheap (12,706), and the choice flipped on that margin: 12,843 against
-- 12,714. Page one was fast only by luck, because a second wrong estimate happened
-- to favour the right plan.
--
-- Two things were tried and rejected before this. A covering index on
-- people (last_name, first_name, id) INCLUDE the projected columns fixed offset 20
-- and nothing beyond it, because the index path's estimated cost grows with the
-- offset while the seq cost is flat, so the planner flipped back at page 3; 12 MB
-- to fix one page is not a trade. Rewriting can_read_person as an inlinable
-- `language sql` function cannot work either: Postgres never inlines a SECURITY
-- DEFINER function, and this one must be one, or its reads of people would recurse
-- through people's own policy.
--
-- Restating both policies as CASE over a single hoisted role lookup is what works.
-- The EXISTS clauses have real statistics behind them, so they cost as semi-joins
-- for a scan and as index probes for a single row, and the CASE gives the planner
-- one branch to estimate instead of an opaque call. Measured after, same client:
--
--   limit 20 offset 0       15.9 ms
--   limit 20 offset 20      16.3 ms
--   limit 20 offset 2000    20.9 ms
--   exact count            306 ms
--
-- End to end in the browser, three runs each, the candidate list's first data row
-- goes 284 ms to 283 ms, its total 1,571 ms to 360 ms, and a page turn 1,080 ms to
-- 88 ms.
--
-- The rules are unchanged. Two branches are simplified only where the algebra is
-- exact. can_read_person's recruiter branch reads
--   A or B or (C and not A and not B)
-- with A = has a candidate profile, B = has a contact profile, C = created_by is
-- me, and that is equivalent to A or B or C: when A or B holds the first two terms
-- cover it, and when neither holds `not A and not B` is already true. The bd branch
-- is B or (C and not A and not B), which reduces to B or (C and not A), and the
-- `not A` there is load-bearing rather than redundant: a bd user must not see a
-- candidate they happen to have created. candidate_profiles_select's CASE denies on
-- a null role through its ELSE, where the OR form denied by evaluating to null;
-- both deny.
--
-- get_my_role() and auth.uid() stay wrapped in scalar subselects so they plan as
-- InitPlans evaluated once per statement, the convention 20260902000002 set.
--
-- can_read_person is kept and unchanged, because the attachments and activities
-- parent_type dispatcher and one other helper still call it. That leaves the same
-- rule written in two places, which is a real drift risk rather than a theoretical
-- one, so supabase/tests/validate.sql checks 31 and 32 assert that each policy still
-- admits exactly the rows it should for every role, reading the policy's own
-- expression out of pg_policies so the test cannot drift from what is enforced.

drop policy if exists people_select on public.people;

create policy people_select on public.people for select
  using (
    case (select public.get_my_role())
      when 'admin' then true
      when 'recruiter' then (
        exists (select 1 from public.candidate_profiles cp where cp.person_id = people.id)
        or exists (select 1 from public.contact_profiles c where c.person_id = people.id)
        or people.created_by = (select auth.uid())
      )
      when 'sourcer' then (
        exists (
          select 1 from public.candidate_profiles cp
          where cp.person_id = people.id and cp.sourcer_id = (select auth.uid())
        )
      )
      when 'bd' then (
        exists (select 1 from public.contact_profiles c where c.person_id = people.id)
        or (
          people.created_by = (select auth.uid())
          and not exists (select 1 from public.candidate_profiles cp where cp.person_id = people.id)
        )
      )
      else false
    end
  );

drop policy if exists candidate_profiles_select on public.candidate_profiles;

create policy candidate_profiles_select on public.candidate_profiles for select
  using (
    case (select public.get_my_role())
      when 'admin' then true
      when 'recruiter' then true
      when 'sourcer' then sourcer_id = (select auth.uid())
      else false
    end
  );

create index if not exists idx_contact_profiles_person_id
  on public.contact_profiles (person_id);
create index if not exists idx_people_created_by
  on public.people (created_by);
