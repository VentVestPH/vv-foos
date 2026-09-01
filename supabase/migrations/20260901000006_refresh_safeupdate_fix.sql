-- Make the dashboard's "Refresh now" button work.
--
-- dash.refresh_materialized_views is called from ExperimentMetrics and the
-- other dashboard widgets through PostgREST. PostgREST connects as the
-- `authenticator` role, which Supabase configures with
-- session_preload_libraries = 'supautils, safeupdate'. safeupdate raises
-- "DELETE requires a WHERE clause" on any unqualified DELETE, and it applies
-- inside SECURITY DEFINER functions too, because it is a session-level guard
-- rather than a privilege check.
--
-- dash._refresh_stage_duration_cache opened with two unqualified DELETEs, so
-- every call through the API aborted before refreshing anything. The button has
-- never worked for a signed-in user. It went unnoticed because the pg_cron jobs
-- that call the same functions run as postgres over a local connection, which
-- never loads safeupdate, so the scheduled refreshes always succeeded.
--
-- Verified against the local stack on 2026-09-01: as a signed-in admin,
-- rpc('refresh_materialized_views') returned that error and left the metric
-- cache at its previous 7 rows instead of the current 16.
--
-- `where true` satisfies safeupdate and is planned identically to an
-- unqualified DELETE (a full sequential scan), so there is no cost.

create or replace function dash._refresh_stage_duration_cache()
returns void
language plpgsql
security definer
set search_path to 'public', 'dash'
as $function$
begin
  delete from dash._stage_duration_cache where true;

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

  delete from dash._staff_stage_advances_cache where true;

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
$function$;
