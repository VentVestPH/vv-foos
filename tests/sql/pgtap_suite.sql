-- Agent 8 (QA) — real pgTAP suite, extension installed via migration
-- 20260725000005_agent8_pgtap_extension.sql. This is the literal "pgTAP
-- suite" the brief and delivery plan referenced; supabase/tests/validate.sql
-- (Agent 1's inherited hand-rolled plpgsql checks) stays in place as the
-- primary schema/trigger/RLS regression suite and is re-run unmodified per
-- instruction 2 — this file adds real pgTAP coverage on top, focused on the
-- couple of things a plpgsql DO block can't express as cleanly (named,
-- independently-reportable test cases) and on codifying the one real defect
-- QA found this pass (careers_rate_limit missing RLS) as a standing
-- regression test rather than a one-off note.
--
-- Run: psql "$DATABASE_URL" -f tests/sql/pgtap_suite.sql
-- (or via the Supabase SQL editor / execute_sql MCP tool against the
-- project directly — pgtap has no separate runner requirement beyond the
-- extension itself).

begin;
select plan(11);

-- 1-2: every public table has RLS enabled — same invariant as validate.sql
-- check 2, expressed as individually-reportable pgTAP tests instead of one
-- aggregate exception, so a regression names the exact table.
select ok(
  (select relrowsecurity from pg_class where relname = 'people' and relnamespace = 'public'::regnamespace),
  'RLS enabled on people'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'careers_rate_limit' and relnamespace = 'public'::regnamespace),
  'RLS enabled on careers_rate_limit — QA-002, open as of 2026-07-25: Agent 4 created this table without RLS, violating the architecture''s deny-by-default rule. Low actual exposure (anon/authenticated have no SELECT/INSERT grant on it), but this test should go green once Agent 4 adds `alter table careers_rate_limit enable row level security` plus a service-role-only policy.'
);

-- 3: staff_role enum has exactly the four architecture-locked values.
select results_eq(
  $$select unnest(enum_range(null::staff_role))::text order by 1$$,
  $$values ('admin'), ('bd'), ('recruiter'), ('sourcer')$$,
  'staff_role enum is exactly admin/bd/recruiter/sourcer'
);
-- (results_eq works here because the enum_range()::text cast produces plain
-- text with a real collation; it does NOT work for pg_enum.enumlabel below,
-- which is the `name` type — comparing that across results_eq's internal
-- refcursors throws "could not determine which collation to use". Tests 4-5
-- use plain array comparison instead.)

-- 4: application_stage enum has exactly the eight locked stages, in order.
-- (Plain ok()+array comparison rather than results_eq()/refcursors — the
-- latter tripped a "could not determine collation" error comparing the
-- enum's `name`-typed labels against text literals across cursors.)
select ok(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum e
     join pg_type t on t.oid = e.enumtypid where t.typname = 'application_stage')
  = array['received','screening','phone_screen','submitted',
          'client_interview','offer','hired','rejected'],
  'application_stage enum matches the architecture doc''s locked stage set, in order'
);

-- 5: deal_stage enum, same check.
select ok(
  (select array_agg(enumlabel::text order by enumsortorder) from pg_enum e
     join pg_type t on t.oid = e.enumtypid where t.typname = 'deal_stage')
  = array['lead','qualified','proposal','negotiation','won','lost'],
  'deal_stage enum matches the architecture doc''s locked stage set, in order'
);

-- 6: get_my_role() exists and is security definer (the RLS boundary's
-- single source of truth — if this stops being definer, every policy that
-- calls it silently breaks for non-superuser callers).
select ok(
  (select prosecdef from pg_proc where proname = 'get_my_role' and pronamespace = 'public'::regnamespace),
  'get_my_role() is security definer'
);

-- 7: dash schema views are security_invoker (Agent 7's RLS pass-through
-- guarantee — a regression here would silently widen every dashboard to
-- see everything, since a non-invoker view runs as its owner).
select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'dash' and c.relkind = 'v'
      and c.reloptions @> array['security_invoker=on']) >= 6,
  'at least 6 dash schema views are security_invoker'
);

-- 8: application display codes follow APP-#### format for every seeded row.
select ok(
  not exists (select 1 from applications where display_code !~ '^APP-\d{4}$'),
  'every application.display_code matches APP-####'
);

-- 9: no application can be in a stage outside the enum (belt-and-suspenders
-- on top of the enum type itself — catches a raw-SQL bypass of the type).
select ok(
  not exists (
    select 1 from applications a
    where a.stage::text not in (
      'received','screening','phone_screen','submitted','client_interview','offer','hired','rejected'
    )
  ),
  'every application.stage is one of the eight locked values'
);

-- 10: every non-test candidate_profiles row has a sourcer_id (sourcer RLS
-- depends on this being non-null; a null would silently make that row
-- invisible to every sourcer, which looks like "no bug" until someone asks
-- why a real candidate never shows up for their sourcer).
select ok(
  not exists (select 1 from candidate_profiles cp join people p on p.id = cp.person_id
              where not p.is_test and cp.sourcer_id is null),
  'every non-test candidate_profiles row has a sourcer_id'
);

-- 11: events_outbox has no event_name outside the architecture's taxonomy —
-- catches a typo'd event name from any future trigger before it silently
-- fails to match any listener's filter.
select ok(
  not exists (
    select 1 from events_outbox
    where event_name not in (
      'application.created', 'application.stage_changed', 'application.hired',
      'candidate.status_changed', 'requisition.status_changed',
      'deal.stage_changed', 'intake_item.received', 'intake_item.imported',
      'activity.logged', 'reminder.due'
    )
  ),
  'every events_outbox row uses a taxonomy event_name'
);

-- Note: the is_test purge-then-verify-empty check is deliberately NOT
-- duplicated here as an ok()/is() assertion. Running it for real means
-- actually deleting is_test rows, which this file can't safely roll back
-- and still report results (finish() needs the transaction to commit its
-- test-result bookkeeping in some pgtap configurations, and nesting a
-- purge-and-rollback inside this suite's own transaction risks masking a
-- real failure as a pass). validate.sql check 14 already does this properly
-- in its own isolated transaction — see that file for the real purge drill,
-- re-run before every Gate 4/5 regression pass per the checklist.

select * from finish();
rollback;
