-- Triggers: updated_at, audit_log writer, events_outbox writers for the 9
-- trigger-fired domain events, status_change activities, application stage
-- maintenance, reminder.due function + pg_cron job.

-- ---------------------------------------------------------------- updated_at

create trigger trg_people_updated_at before update on people
  for each row execute function public.fn_set_updated_at();
create trigger trg_companies_updated_at before update on companies
  for each row execute function public.fn_set_updated_at();
create trigger trg_requisitions_updated_at before update on requisitions
  for each row execute function public.fn_set_updated_at();
create trigger trg_deals_updated_at before update on deals
  for each row execute function public.fn_set_updated_at();
create trigger trg_integration_settings_updated_at before update on integration_settings
  for each row execute function public.fn_set_updated_at();

-- ------------------------------------------------------------------- helpers

-- Outbox writer. security definer: table owner bypasses RLS.
create or replace function public.fn_emit_event(p_event text, p_aggregate uuid, p_payload jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into events_outbox (event_name, aggregate_id, payload)
  values (p_event, p_aggregate, coalesce(p_payload, '{}'::jsonb));
$$;

-- status_change activity writer used by every transition trigger.
create or replace function public.fn_log_status_change(
  p_subject text, p_body text,
  p_person uuid default null, p_company uuid default null, p_deal uuid default null,
  p_application uuid default null, p_requisition uuid default null)
returns void
language sql security definer set search_path = public
as $$
  insert into activities (kind, subject, body, person_id, company_id, deal_id, application_id, requisition_id, created_by)
  values ('status_change', p_subject, p_body, p_person, p_company, p_deal, p_application, p_requisition, auth.uid());
$$;

-- ----------------------------------------------------------------- audit_log

create or replace function public.fn_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  rec jsonb;
  rid uuid;
  d jsonb;
begin
  rec := to_jsonb(coalesce(new, old));
  rid := coalesce(
    (rec ->> 'id')::uuid,
    (rec ->> 'person_id')::uuid,
    (rec ->> 'application_id')::uuid,
    (rec ->> 'requisition_id')::uuid);
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(e.key, jsonb_build_object('old', to_jsonb(old) -> e.key, 'new', e.value))
      into d
      from jsonb_each(to_jsonb(new)) e
     where to_jsonb(old) -> e.key is distinct from e.value;
  elsif tg_op = 'INSERT' then
    d := rec;
  else
    d := rec;
  end if;
  insert into audit_log (table_name, record_id, action, actor_id, diff)
  values (tg_table_name, rid, lower(tg_op), auth.uid(), d);
  return coalesce(new, old);
end $$;

-- Every business table logs. Skipped: audit_log/events_outbox (infrastructure),
-- application_views (per-user view markers), integration_settings (sync-cursor noise).
do $$
declare
  t text;
begin
  foreach t in array array[
    'staff', 'people', 'companies', 'sources', 'candidate_statuses',
    'candidate_profiles', 'requisitions', 'requisition_owners', 'requisition_approvers',
    'applications', 'intake_items', 'contact_profiles', 'deals', 'tickets',
    'activities', 'tasks', 'reminders', 'attachments',
    'ats_saved_views', 'intake_mapping_templates']
  loop
    execute format(
      'create trigger trg_%s_audit after insert or update or delete on %I
         for each row execute function public.fn_audit()', t, t);
  end loop;
end $$;

-- -------------------------------------------------------------- intake_items

create or replace function public.fn_intake_received()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.fn_emit_event('intake_item.received', new.id, jsonb_build_object(
    'channel', new.channel, 'target_type', new.target_type,
    'full_name', new.full_name, 'batch_label', new.batch_label));
  return new;
end $$;

create trigger trg_intake_items_received after insert on intake_items
  for each row execute function public.fn_intake_received();

create or replace function public.fn_intake_imported()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'imported' and new.person_id is not null then
    perform public.fn_emit_event('intake_item.imported', new.id, jsonb_build_object(
      'person_id', new.person_id, 'target_type', new.target_type, 'channel', new.channel));
  end if;
  return new;
end $$;

create trigger trg_intake_items_imported after update on intake_items
  for each row execute function public.fn_intake_imported();

-- -------------------------------------------------------------- applications

-- Stage bookkeeping before write: stage_changed_at and hired_at.
create or replace function public.fn_application_stage_before()
returns trigger
language plpgsql
as $$
begin
  if old.stage is distinct from new.stage then
    new.stage_changed_at := now();
    if new.stage = 'hired' and new.hired_at is null then
      new.hired_at := now();
    end if;
  end if;
  return new;
end $$;

create trigger trg_applications_stage_before before update on applications
  for each row execute function public.fn_application_stage_before();

create or replace function public.fn_application_created()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.fn_emit_event('application.created', new.id, jsonb_build_object(
    'requisition_id', new.requisition_id, 'person_id', new.person_id, 'stage', new.stage));
  return new;
end $$;

create trigger trg_applications_created after insert on applications
  for each row execute function public.fn_application_created();

create or replace function public.fn_application_stage_after()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.stage is distinct from new.stage then
    perform public.fn_emit_event('application.stage_changed', new.id, jsonb_build_object(
      'requisition_id', new.requisition_id, 'person_id', new.person_id,
      'from', old.stage, 'to', new.stage));
    perform public.fn_log_status_change(
      'Application stage: ' || old.stage || ' -> ' || new.stage,
      new.display_code,
      p_person => new.person_id, p_application => new.id, p_requisition => new.requisition_id);
    if new.stage = 'hired' then
      perform public.fn_emit_event('application.hired', new.id, jsonb_build_object(
        'requisition_id', new.requisition_id, 'person_id', new.person_id, 'hired_at', new.hired_at));
    end if;
  end if;
  return new;
end $$;

create trigger trg_applications_stage_after after update on applications
  for each row execute function public.fn_application_stage_after();

-- -------------------------------------------------- candidate status (global)

create or replace function public.fn_candidate_status_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status_id is distinct from new.status_id then
    perform public.fn_emit_event('candidate.status_changed', new.person_id, jsonb_build_object(
      'from_status_id', old.status_id, 'to_status_id', new.status_id));
    perform public.fn_log_status_change(
      'Candidate status changed',
      (select label from candidate_statuses where id = new.status_id),
      p_person => new.person_id);
  end if;
  return new;
end $$;

create trigger trg_candidate_profiles_status after update on candidate_profiles
  for each row execute function public.fn_candidate_status_changed();

-- Sourcers may change grade fields only; RLS lets them at the row, this guards columns.
create or replace function public.fn_candidate_grade_guard()
returns trigger
language plpgsql
as $$
begin
  if public.get_my_role() = 'sourcer'
     and (to_jsonb(new) - 'star_grade' - 'grade_comment')
         is distinct from (to_jsonb(old) - 'star_grade' - 'grade_comment') then
    raise exception 'sourcer may update star_grade and grade_comment only';
  end if;
  return new;
end $$;
-- Trigger attached in the RLS migration, after get_my_role() exists.

-- -------------------------------------------------------------- requisitions

create or replace function public.fn_requisition_status_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.fn_emit_event('requisition.status_changed', new.id, jsonb_build_object(
      'from', old.status, 'to', new.status, 'display_code', new.display_code));
    perform public.fn_log_status_change(
      'Requisition status: ' || old.status || ' -> ' || new.status,
      new.display_code,
      p_requisition => new.id, p_company => new.company_id);
  end if;
  return new;
end $$;

create trigger trg_requisitions_status after update on requisitions
  for each row execute function public.fn_requisition_status_changed();

-- Approver decisions also fire requisition.status_changed.
create or replace function public.fn_requisition_approver_decided()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.decision is distinct from new.decision and new.decision is not null then
    perform public.fn_emit_event('requisition.status_changed', new.requisition_id, jsonb_build_object(
      'approver_id', new.staff_id, 'approver_type', new.approver_type,
      'decision', new.decision, 'decided_at', new.decided_at));
    perform public.fn_log_status_change(
      'Requisition ' || new.approver_type || ' approval: ' || new.decision, null,
      p_requisition => new.requisition_id);
  end if;
  return new;
end $$;

create trigger trg_requisition_approvers_decision after update on requisition_approvers
  for each row execute function public.fn_requisition_approver_decided();

-- --------------------------------------------------------------------- deals

create or replace function public.fn_deal_stage_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.stage is distinct from new.stage then
    perform public.fn_emit_event('deal.stage_changed', new.id, jsonb_build_object(
      'from', old.stage, 'to', new.stage, 'display_code', new.display_code));
    perform public.fn_log_status_change(
      'Deal stage: ' || old.stage || ' -> ' || new.stage,
      new.display_code,
      p_deal => new.id, p_company => new.company_id, p_person => new.primary_contact_id);
  end if;
  return new;
end $$;

create trigger trg_deals_stage after update on deals
  for each row execute function public.fn_deal_stage_changed();

-- ------------------------------------------------------------------- tickets
-- Ticket transitions log an activity + audit row; no outbox event in the v1 taxonomy.

create or replace function public.fn_ticket_status_changed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.fn_log_status_change(
      'Ticket status: ' || old.status || ' -> ' || new.status,
      new.display_code,
      p_company => new.company_id, p_person => new.person_id);
  end if;
  return new;
end $$;

create trigger trg_tickets_status after update on tickets
  for each row execute function public.fn_ticket_status_changed();

-- ---------------------------------------------------------------- activities

create or replace function public.fn_activity_logged()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.fn_emit_event('activity.logged', new.id, jsonb_build_object(
    'kind', new.kind, 'person_id', new.person_id, 'company_id', new.company_id,
    'deal_id', new.deal_id, 'application_id', new.application_id,
    'requisition_id', new.requisition_id));
  return new;
end $$;

create trigger trg_activities_logged after insert on activities
  for each row execute function public.fn_activity_logged();

-- ------------------------------------------------------------- reminder.due

create or replace function public.fn_fire_due_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  fired integer;
begin
  with due as (
    update reminders
       set status = 'fired'
     where status = 'pending' and remind_at <= now()
    returning id, staff_id, subject, remind_at, related_type, related_id
  )
  insert into events_outbox (event_name, aggregate_id, payload)
  select 'reminder.due', id, jsonb_build_object(
           'staff_id', staff_id, 'subject', subject, 'remind_at', remind_at,
           'related_type', related_type, 'related_id', related_id)
    from due;
  get diagnostics fired = row_count;
  return fired;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('foos-reminder-due', '* * * * *', 'select public.fn_fire_due_reminders()');
  else
    raise notice 'pg_cron absent: schedule fn_fire_due_reminders() externally';
  end if;
end $$;
