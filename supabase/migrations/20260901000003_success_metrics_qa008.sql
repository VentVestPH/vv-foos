-- QA-008: instrument the four committed success metrics.
--
-- The delivery plan's Phase 6 gate is "measure 30 days: adoption, cycle time vs
-- baseline, data quality" before the Taleo and Zoho subscriptions are
-- cancelled. dash._refresh_success_metrics previously computed seven volume
-- counters (requisitions opened/filled, applications received/hired, deals
-- won/lost, open pipeline value) and none of the four gating metrics. This adds
-- them to the same weekly cache so one refresh feeds everything.
--
-- Formulas, per Agent 7 brief instruction 7:
--   adoption      distinct staff who wrote anything this week / active staff
--   cycle time    median intake -> submitted, median deal created -> won
--   cost          total monthly cost of the systems being replaced
--   data quality  dedup rate, contact completeness, grading preserved
--
-- Stage timestamps come from audit_log.diff->'stage', the same source
-- dash._refresh_stage_duration_cache uses, so cycle time and time-in-stage
-- cannot disagree. Every ratio uses nullif on its denominator: an empty week
-- stores null, which reads as "not measured" rather than a misleading zero.
-- Test rows are excluded on the same is_test predicates as the existing
-- counters.

create or replace function dash._refresh_success_metrics()
returns void
language plpgsql
security definer
set search_path to 'public', 'dash'
as $function$
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
  where not d.is_test and not c.is_test and d.stage not in ('won', 'lost')

  union all
  select 'adoption_active_staff', wk, count(distinct al.actor_id), 'count'
  from audit_log al
  join staff s on s.id = al.actor_id
  where s.is_active and al.at >= wk and al.at < wk + 7
  union all
  select 'adoption_total_staff', wk, count(*), 'count'
  from staff s where s.is_active
  union all
  select
    'adoption_rate',
    wk,
    (select count(distinct al.actor_id)
       from audit_log al
       join staff s on s.id = al.actor_id
      where s.is_active and al.at >= wk and al.at < wk + 7)::numeric
      / nullif((select count(*) from staff where is_active), 0),
    'ratio'

  union all
  select
    'cycle_time_intake_to_submitted_days',
    wk,
    percentile_cont(0.5) within group (order by t.days),
    'days'
  from (
    select extract(epoch from (min(al.at) - ii.created_at)) / 86400.0 as days
    from intake_items ii
    join applications a on a.person_id = ii.person_id
    join requisitions r on r.id = a.requisition_id
    join people p on p.id = a.person_id
    join audit_log al
      on al.table_name = 'applications'
     and al.record_id = a.id
     and al.action = 'update'
     and al.diff ? 'stage'
     and al.diff->'stage'->>'new' = 'submitted'
    where not r.is_test and not p.is_test
      and ii.person_id is not null
      and al.at >= wk and al.at < wk + 7
    group by a.id, ii.created_at
  ) t
  union all
  select
    'cycle_time_deal_created_to_won_days',
    wk,
    percentile_cont(0.5) within group (order by t.days),
    'days'
  from (
    select extract(epoch from (min(al.at) - d.created_at)) / 86400.0 as days
    from deals d
    join companies c on c.id = d.company_id
    join audit_log al
      on al.table_name = 'deals'
     and al.record_id = d.id
     and al.action = 'update'
     and al.diff ? 'stage'
     and al.diff->'stage'->>'new' = 'won'
    where not d.is_test and not c.is_test
      and al.at >= wk and al.at < wk + 7
    group by d.id, d.created_at
  ) t

  union all
  select 'cost_monthly_total', wk, sum(ci.monthly_cost), 'currency'
  from dash.cost_inputs ci

  union all
  select
    'data_quality_dedup_rate',
    wk,
    count(*) filter (where ii.duplicate_of is not null)::numeric / nullif(count(*), 0),
    'ratio'
  from intake_items ii
  where ii.created_at >= wk and ii.created_at < wk + 7
  union all
  select
    'data_quality_contact_completeness',
    wk,
    count(*) filter (
      where jsonb_array_length(coalesce(p.emails, '[]'::jsonb)) > 0
        and jsonb_array_length(coalesce(p.phones, '[]'::jsonb)) > 0
    )::numeric / nullif(count(*), 0),
    'ratio'
  from people p
  where not p.is_test
  union all
  select
    'data_quality_grading_preserved',
    wk,
    count(*) filter (where cp.star_grade is not null)::numeric / nullif(count(*), 0),
    'ratio'
  from candidate_profiles cp
  join people p on p.id = cp.person_id
  where not p.is_test;

  refresh materialized view dash.mv_success_metrics;
end;
$function$;
