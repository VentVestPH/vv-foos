-- Agent 7 (Dashboards) — dash schema. Owns no operational tables; only
-- views/materialized views plus two config tables (thresholds, cost_inputs).
-- Every view is security_invoker = on so Postgres RLS on the underlying
-- tables (owned by Agents 1-5) is the real access boundary — this schema
-- never widens visibility. The one exception (mv_stage_durations, plus the
-- staff-stage-advances mv) is audit_log-derived and definer-refreshed per the
-- brief's explicit carve-out, and exposes only stage names/durations/
-- display_codes/counts — never actor identity, diffs, or person names beyond
-- what the row-level views already expose under RLS.

create schema if not exists dash;

-- ------------------------------------------------------------------ config

create table dash.thresholds (
  metric text primary key,
  days integer not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references staff(id)
);

insert into dash.thresholds (metric, days) values ('requisition_aging_days', 14);

alter table dash.thresholds enable row level security;

create policy thresholds_read on dash.thresholds
  for select using (public.get_my_role() is not null);
create policy thresholds_write on dash.thresholds
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create table dash.cost_inputs (
  system text primary key,
  monthly_cost numeric,
  currency text not null default 'USD',
  entered_at timestamptz,
  entered_by uuid references staff(id)
);

alter table dash.cost_inputs enable row level security;

create policy cost_inputs_read on dash.cost_inputs
  for select using (public.get_my_role() is not null);
create policy cost_inputs_write on dash.cost_inputs
  for all using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ------------------------------------------------------------- Dashboard 1
-- Pipeline by Stage — ATS + CRM funnels. Row-level (not pre-aggregated) so
-- the frontend applies the global date-range filter and does the counting;
-- security_invoker means a sourcer only ever sees their own-sourced
-- candidates' applications, a bd user sees CRM only, etc. — same as if they
-- queried applications/deals directly.

create view dash.vw_ats_funnel
with (security_invoker = on) as
select
  a.id as application_id,
  a.display_code,
  a.requisition_id,
  r.display_code as requisition_code,
  r.title as requisition_title,
  r.company_id,
  a.person_id,
  a.stage,
  a.source_id,
  s.name as source_name,
  cp.sourcer_id,
  a.is_shortlisted,
  a.rank,
  a.applied_at,
  a.stage_changed_at,
  a.hired_at
from applications a
join requisitions r on r.id = a.requisition_id
join people p on p.id = a.person_id
left join sources s on s.id = a.source_id
left join candidate_profiles cp on cp.person_id = a.person_id
where not r.is_test and not p.is_test;

create view dash.vw_crm_funnel
with (security_invoker = on) as
select
  d.id as deal_id,
  d.display_code,
  d.name,
  d.company_id,
  c.name as company_name,
  d.owner_id,
  d.stage,
  d.value,
  d.currency,
  d.probability,
  d.expected_close,
  d.created_at,
  d.updated_at
from deals d
join companies c on c.id = d.company_id
where not d.is_test and not c.is_test;

-- ------------------------------------------------------------- Dashboard 3
-- Source Effectiveness — intake-channel lens. The source-of-hire lens (by
-- `sources.name`) reuses dash.vw_ats_funnel.source_name directly, so no
-- separate view is needed for that half of the dashboard.

create view dash.vw_source_effectiveness
with (security_invoker = on) as
select
  i.id as intake_item_id,
  i.channel,
  i.target_type,
  i.status,
  i.submitted_by,
  i.duplicate_of,
  i.person_id,
  i.star_grade,
  i.created_at,
  exists (
    select 1 from applications a
    where a.person_id = i.person_id and a.stage = 'hired'
  ) as reached_hired,
  exists (
    select 1 from deals d
    where d.primary_contact_id = i.person_id and d.stage = 'won'
  ) as reached_won
from intake_items i
left join people p on p.id = i.person_id
where p.id is null or not p.is_test;

-- ------------------------------------------------------------- Dashboard 4
-- Recruiter/Sourcer Activity — raw facts only, no ranking/leaderboard
-- coloring (business rule from the brief: this dashboard shows counts, never
-- a sorted "best performer" list).

create view dash.vw_staff_activities
with (security_invoker = on) as
select
  act.id as activity_id,
  act.kind,
  act.occurred_at,
  act.created_by,
  act.person_id,
  act.company_id,
  act.deal_id,
  act.application_id,
  act.requisition_id
from activities act
left join people p on p.id = act.person_id
left join companies c on c.id = act.company_id
left join deals d on d.id = act.deal_id
where (p.id is null or not p.is_test)
  and (c.id is null or not c.is_test)
  and (d.id is null or not d.is_test);

-- Grading counts (star_grade set at intake time) attributed to submitted_by,
-- per the brief's "grading counts (1*/2*/3* split)" activity metric.
create view dash.vw_staff_grading
with (security_invoker = on) as
select
  i.id as intake_item_id,
  i.submitted_by,
  i.star_grade,
  i.created_at
from intake_items i
left join people p on p.id = i.person_id
where i.star_grade is not null
  and (p.id is null or not p.is_test);

-- ------------------------------------------------------------- Dashboard 5
-- Requisition Aging. days_open and unviewed-for-me are computed here since
-- both are cheap and RLS-safe (application_views is already user-scoped by
-- the caller's own auth.uid(), read through security_invoker as normal).

create view dash.vw_requisition_aging
with (security_invoker = on) as
select
  r.id as requisition_id,
  r.display_code,
  r.title,
  r.company_id,
  c.name as company_name,
  r.status,
  r.opened_date,
  r.filled_date,
  (current_date - r.opened_date) as days_open,
  (
    select count(*) from requisition_owners ro where ro.requisition_id = r.id
  ) as owner_count,
  exists (
    select 1 from requisition_owners ro
    where ro.requisition_id = r.id and ro.staff_id = auth.uid()
  ) as i_am_owner,
  (
    select count(*) from applications a
    where a.requisition_id = r.id and a.stage not in ('hired', 'rejected')
  ) as open_applications,
  (
    select count(*) from applications a
    where a.requisition_id = r.id
      and a.stage not in ('hired', 'rejected')
      and not exists (
        select 1 from application_views av
        where av.application_id = a.id and av.staff_id = auth.uid()
      )
  ) as unviewed_applications
from requisitions r
join companies c on c.id = r.company_id
where not r.is_test;

-- ------------------------------------------------------ audit_log-derived
-- mv_stage_durations exception (brief-sanctioned): audit_log is admin-read
-- only, so a definer-owned refresh job pre-aggregates it into a materialized
-- view exposing only stage names, durations, and entity display_codes —
-- never actor identity, diff payloads, or person names. Refreshed by
-- pg_cron every 15 minutes plus an admin manual-refresh button.

create table dash._stage_duration_cache (
  entity_type text not null,
  entity_id uuid not null,
  display_code text not null,
  stage_from text,
  stage_to text not null,
  changed_at timestamptz not null,
  duration_days numeric,
  is_test boolean not null default false,
  primary key (entity_type, entity_id, changed_at, stage_to)
);

create materialized view dash.mv_stage_durations as
select entity_type, display_code, stage_from, stage_to, changed_at, duration_days
from dash._stage_duration_cache
where not is_test
with no data;

create unique index mv_stage_durations_uq
  on dash.mv_stage_durations (entity_type, display_code, changed_at, stage_to);

revoke all on dash._stage_duration_cache from public, authenticated, anon;
grant select on dash.mv_stage_durations to authenticated;

-- Per-staff stage-advance counts (Dashboard 4 metric) — same audit_log
-- exception, same "no identity beyond a staff_id count" limit. Backed by a
-- plain cache table (materialized views can't be written to directly).
create table dash._staff_stage_advances_cache (
  staff_id uuid not null,
  advances_count integer not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  primary key (staff_id, window_start)
);

create materialized view dash.mv_staff_stage_advances as
select staff_id, advances_count, window_start, window_end
from dash._staff_stage_advances_cache
with no data;

create unique index mv_staff_stage_advances_uq
  on dash.mv_staff_stage_advances (staff_id, window_start);

revoke all on dash._staff_stage_advances_cache from public, authenticated, anon;
grant select on dash.mv_staff_stage_advances to authenticated;

-- Internal refresh worker — security definer, not exposed to PostgREST
-- (no grant to anon/authenticated on the function itself beyond the two
-- public wrappers below). Rebuilds the audit_log-derived cache from scratch
-- each run; volumes are modest enough per the brief that a full rebuild
-- every 15 minutes is simpler and safer than incremental upkeep.
--
-- QA-005 fix (2026-07-25, found during Agent 8's dashboard spot-check):
-- fn_audit()'s UPDATE diff shape is {"col": {"old": ..., "new": ...}, ...}
-- per changed column (see 20260711000010_triggers.sql fn_audit()) — the
-- original ->>0/->>1 array-index reads always returned null against that
-- object, so stage_from/stage_to were silently null for every real
-- transition (masked at the time since all seed data was is_test and this
-- cache excludes is_test rows, so the bug produced an empty result either
-- way). Fixed to read ->>'old'/->>'new' directly; also added `al.action =
-- 'update'` to the WHERE clauses so INSERT rows (whose diff is the whole
-- new row, not an {old,new} pair) don't sneak in as a from=to=null row.
-- Verified against a real (non-test, fully cleaned up after) fixture:
-- three real stage transitions produced correct stage_from/stage_to labels
-- and a duration_days that matched hand-computed
-- (changed_at - previous changed_at) / 86400 exactly.
create or replace function dash._refresh_stage_duration_cache()
returns void
language plpgsql security definer set search_path = public, dash
as $$
begin
  delete from dash._stage_duration_cache;

  insert into dash._stage_duration_cache
    (entity_type, entity_id, display_code, stage_from, stage_to, changed_at, duration_days, is_test)
  select
    'application',
    a.id,
    a.display_code,
    al.diff->'stage'->>'old',
    al.diff->'stage'->>'new',
    al.at,
    extract(epoch from (al.at - lag(al.at) over w)) / 86400.0,
    r.is_test or p.is_test
  from audit_log al
  join applications a on a.id = al.record_id
  join requisitions r on r.id = a.requisition_id
  join people p on p.id = a.person_id
  where al.table_name = 'applications' and al.action = 'update' and al.diff ? 'stage'
  window w as (partition by a.id order by al.at);

  insert into dash._stage_duration_cache
    (entity_type, entity_id, display_code, stage_from, stage_to, changed_at, duration_days, is_test)
  select
    'requisition',
    req.id,
    req.display_code,
    al.diff->'status'->>'old',
    al.diff->'status'->>'new',
    al.at,
    extract(epoch from (al.at - lag(al.at) over w)) / 86400.0,
    req.is_test
  from audit_log al
  join requisitions req on req.id = al.record_id
  where al.table_name = 'requisitions' and al.action = 'update' and al.diff ? 'status'
  window w as (partition by req.id order by al.at);

  delete from dash._staff_stage_advances_cache;

  insert into dash._staff_stage_advances_cache (staff_id, advances_count, window_start, window_end)
  select al.actor_id, count(*), date_trunc('week', now() - interval '90 days'), now()
  from audit_log al
  join applications a on a.id = al.record_id
  join requisitions r on r.id = a.requisition_id
  join people p on p.id = a.person_id
  where al.table_name = 'applications' and al.action = 'update' and al.diff ? 'stage'
    and al.at >= now() - interval '90 days'
    and not r.is_test and not p.is_test
    and al.actor_id is not null
  group by al.actor_id;

  refresh materialized view dash.mv_stage_durations;
  refresh materialized view dash.mv_staff_stage_advances;
end;
$$;

revoke all on function dash._refresh_stage_duration_cache() from public, authenticated, anon;

-- Public wrapper — admin manual-refresh button calls this via RPC.
create or replace function dash.refresh_materialized_views()
returns void
language plpgsql security definer set search_path = public, dash
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admin can refresh dashboard materialized views';
  end if;
  perform dash._refresh_stage_duration_cache();
end;
$$;

grant execute on function dash.refresh_materialized_views() to authenticated;

-- pg_cron entry point — runs as the job owner (postgres), no auth.uid()
-- context, so it calls the internal worker directly rather than the
-- admin-gated wrapper.
-- Guarded exactly as migration 20260711000010_triggers.sql guards its own
-- cron.schedule call. Unguarded, this aborted the whole migration on any host
-- without pg_cron (plain Postgres, CI), leaving the dash schema half-built and
-- making the repository unable to rebuild production. Behaviour on Supabase is
-- unchanged: pg_cron is present, so the job is still scheduled.
do $guard$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'dash-refresh-materialized-views',
      '*/15 * * * *',
      $$select dash._refresh_stage_duration_cache();$$
    );
  else
    raise notice 'pg_cron absent: refresh dash materialized views externally, or via dash.refresh_materialized_views()';
  end if;
end $guard$;

-- --------------------------------------------------------- Experiment panel
-- Admin-only "Experiment metrics" panel — one row per metric per week.
-- Not a numbered dashboard; the brief is explicit that this is a 6th,
-- separate admin-only view, not counted among the five.

create table dash._success_metric_cache (
  metric_key text not null,
  week_start date not null,
  value numeric,
  unit text,
  primary key (metric_key, week_start)
);

create materialized view dash.mv_success_metrics as
select metric_key, week_start, value, unit from dash._success_metric_cache
with no data;

create unique index mv_success_metrics_uq
  on dash.mv_success_metrics (metric_key, week_start);

revoke all on dash._success_metric_cache from public, authenticated, anon;

-- Admin-only read — enforced via a security-barrier view rather than RLS
-- (materialized views can't carry row policies directly).
create view dash.vw_success_metrics
with (security_invoker = off, security_barrier = on) as
select * from dash.mv_success_metrics
where public.get_my_role() = 'admin';

grant select on dash.vw_success_metrics to authenticated;

create or replace function dash._refresh_success_metrics()
returns void
language plpgsql security definer set search_path = public, dash
as $$
declare
  wk date := date_trunc('week', now())::date;
begin
  delete from dash._success_metric_cache where week_start = wk;

  insert into dash._success_metric_cache (metric_key, week_start, value, unit)
  select 'requisitions_opened', wk, count(*), 'count'
  from requisitions r where not r.is_test and r.opened_date >= wk and r.opened_date < wk + 7
  union all
  select 'requisitions_filled', wk, count(*), 'count'
  from requisitions r where not r.is_test and r.filled_date >= wk and r.filled_date < wk + 7
  union all
  select 'applications_received', wk, count(*), 'count'
  from applications a
  join requisitions r on r.id = a.requisition_id
  join people p on p.id = a.person_id
  where not r.is_test and not p.is_test and a.applied_at >= wk and a.applied_at < wk + 7
  union all
  select 'applications_hired', wk, count(*), 'count'
  from applications a
  join requisitions r on r.id = a.requisition_id
  join people p on p.id = a.person_id
  where not r.is_test and not p.is_test and a.hired_at >= wk and a.hired_at < wk + 7
  union all
  select 'deals_won', wk, count(*), 'count'
  from deals d join companies c on c.id = d.company_id
  where not d.is_test and not c.is_test and d.stage = 'won' and d.updated_at >= wk and d.updated_at < wk + 7
  union all
  select 'deals_lost', wk, count(*), 'count'
  from deals d join companies c on c.id = d.company_id
  where not d.is_test and not c.is_test and d.stage = 'lost' and d.updated_at >= wk and d.updated_at < wk + 7
  union all
  select 'pipeline_value_open', wk, coalesce(sum(d.value), 0), 'currency'
  from deals d join companies c on c.id = d.company_id
  where not d.is_test and not c.is_test and d.stage not in ('won', 'lost');

  refresh materialized view dash.mv_success_metrics;
end;
$$;

revoke all on function dash._refresh_success_metrics() from public, authenticated, anon;

do $guard$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'dash-refresh-success-metrics',
      '5,20,35,50 * * * *',
      $$select dash._refresh_success_metrics();$$
    );
  else
    raise notice 'pg_cron absent: refresh dash.mv_success_metrics externally, or via dash.refresh_materialized_views()';
  end if;
end $guard$;

-- Fold the success-metrics refresh into the same admin manual-refresh RPC.
create or replace function dash.refresh_materialized_views()
returns void
language plpgsql security definer set search_path = public, dash
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Only admin can refresh dashboard materialized views';
  end if;
  perform dash._refresh_stage_duration_cache();
  perform dash._refresh_success_metrics();
end;
$$;

-- Prime both materialized views once at migration time so they're not empty
-- until the first cron tick.
select dash._refresh_stage_duration_cache();
select dash._refresh_success_metrics();

-- ------------------------------------------------------------------ grants

grant usage on schema dash to authenticated;
grant select on dash.vw_ats_funnel, dash.vw_crm_funnel, dash.vw_source_effectiveness,
  dash.vw_staff_activities, dash.vw_staff_grading, dash.vw_requisition_aging
  to authenticated;
-- Table-level grant is required in addition to the RLS policies above —
-- Postgres checks GRANTs before RLS, and views alone don't imply base-table
-- access. Row-level restriction (admin-write, all-read) still comes from
-- the policies created earlier in this file.
grant select, insert, update, delete on dash.thresholds, dash.cost_inputs to authenticated;
