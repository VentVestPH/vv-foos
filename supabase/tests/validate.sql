-- FOOS schema validation. Run against a database that has the migrations and
-- seed applied (locally: after tests/local_shim.sql; see README).
-- Superuser required: RLS checks switch to the 'authenticated' role and set
-- request.jwt.claims to simulate signed-in staff. This covers policy logic;
-- real JWT issuance and the Google-domain restriction need Supabase Auth and
-- are out of scope here.
-- Every check raises an exception on failure and a 'PASS ...' notice on success.

-- 1. All expected tables exist -----------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
    from unnest(array[
      'staff', 'people', 'companies', 'activities', 'tasks', 'reminders',
      'attachments', 'sources', 'candidate_statuses', 'audit_log',
      'candidate_profiles', 'requisitions', 'requisition_owners',
      'requisition_approvers', 'applications', 'application_views',
      'intake_items', 'contact_profiles', 'deals', 'tickets', 'events_outbox',
      'ats_saved_views', 'intake_mapping_templates', 'integration_settings']) t
   where not exists (
     select 1 from information_schema.tables
     where table_schema = 'public' and table_name = t);
  if missing is not null then
    raise exception 'FAIL 1: tables missing: %', missing;
  end if;
  raise notice 'PASS 1: all 24 expected tables exist';
end $$;

-- 2. RLS enabled on every public table ---------------------------------------
do $$
declare
  open_tables text;
begin
  select string_agg(c.relname, ', ') into open_tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if open_tables is not null then
    raise exception 'FAIL 2: RLS disabled on: %', open_tables;
  end if;
  raise notice 'PASS 2: RLS enabled on every public table';
end $$;

-- 3. Required triggers exist -------------------------------------------------
do $$
declare
  missing text;
begin
  select string_agg(t, ', ') into missing
    from unnest(array[
      'trg_people_updated_at', 'trg_companies_updated_at',
      'trg_requisitions_updated_at', 'trg_deals_updated_at',
      'trg_integration_settings_updated_at',
      'trg_people_audit', 'trg_staff_audit', 'trg_applications_audit',
      'trg_deals_audit', 'trg_activities_audit',
      'trg_intake_items_received', 'trg_intake_items_imported',
      'trg_applications_stage_before', 'trg_applications_created',
      'trg_applications_stage_after',
      'trg_candidate_profiles_status', 'trg_candidate_profiles_grade_guard',
      'trg_requisitions_status', 'trg_requisition_approvers_decision',
      'trg_deals_stage', 'trg_tickets_status', 'trg_activities_logged']) t
   where not exists (select 1 from pg_trigger where tgname = t);
  if missing is not null then
    raise exception 'FAIL 3: triggers missing: %', missing;
  end if;
  raise notice 'PASS 3: all required triggers exist';
end $$;

-- 4. Display-code sequences --------------------------------------------------
do $$
declare
  code text;
begin
  if not exists (select 1 from requisitions where display_code = 'REQ-0001') then
    raise exception 'FAIL 4: seed requisition REQ-0001 not found';
  end if;
  if not exists (select 1 from applications where display_code = 'APP-0008') then
    raise exception 'FAIL 4: seed application APP-0008 not found';
  end if;
  if not exists (select 1 from deals where display_code = 'DEAL-0002') then
    raise exception 'FAIL 4: seed deal DEAL-0002 not found';
  end if;
  -- Asserts format and monotonic progression, not an absolute first value, and
  -- removes its own rows. Checking for a literal TKT-0001 made this script
  -- pass only against a database on which no ticket had ever been created:
  -- a second run got TKT-0002 and failed.
  declare
    req_id uuid;
    tkt_id uuid;
    prev_max text;
  begin
    select max(display_code) into prev_max from requisitions;
    insert into requisitions (title, status, is_test) values ('Validation req', 'draft', true)
    returning id, display_code into req_id, code;
    if code !~ '^REQ-\d{4}$' or code <= prev_max then
      raise exception 'FAIL 4: unexpected next requisition code % (previous max %)', code, prev_max;
    end if;
    delete from requisitions where id = req_id;

    select max(display_code) into prev_max from tickets;
    insert into tickets (subject) values ('Validation ticket')
    returning id, display_code into tkt_id, code;
    if code !~ '^TKT-\d{4}$' then
      raise exception 'FAIL 4: unexpected ticket code format %', code;
    end if;
    if prev_max is not null and code <= prev_max then
      raise exception 'FAIL 4: ticket code % did not advance past %', code, prev_max;
    end if;
    delete from tickets where id = tkt_id;
  end;

  raise notice 'PASS 4: display codes format and progress correctly (REQ/APP/DEAL/TKT)';
end $$;

-- 5. unique(requisition_id, person_id) on applications ------------------------
do $$
begin
  begin
    insert into applications (requisition_id, person_id)
    values ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001');
    raise exception 'FAIL 5: duplicate (requisition_id, person_id) was accepted';
  exception when unique_violation then
    raise notice 'PASS 5: duplicate application rejected by unique constraint';
  end;
end $$;

-- 5b. Range/enum constraints --------------------------------------------------
do $$
begin
  begin
    update candidate_profiles set star_grade = 4
     where person_id = 'b0000000-0000-4000-8000-000000000001';
    raise exception 'FAIL 5b: star_grade 4 was accepted';
  exception when check_violation then null;
  end;
  begin
    update applications set stage = 'interviewing' where display_code = 'APP-0001';
    raise exception 'FAIL 5b: unlisted application stage accepted';
  exception when invalid_text_representation then null;
  end;
  raise notice 'PASS 5b: star_grade range and application stage enum enforced';
end $$;

-- 6. Application stage transition side effects --------------------------------
do $$
declare
  app uuid;
  audits int; events int; acts int;
  changed timestamptz; hired timestamptz;
begin
  select id into app from applications where display_code = 'APP-0001';  -- stage 'received'

  -- Force the baseline stage before measuring, so a re-run still performs a
  -- real transition. Previously this assumed APP-0001 was still at 'received';
  -- on a second run it was already 'screening', the trigger correctly did
  -- nothing, and the stale stage_changed_at failed the check.
  update applications set stage = 'received' where id = app and stage <> 'received';

  select count(*) into audits from audit_log where table_name = 'applications' and record_id = app and action = 'update';
  update applications set stage = 'screening' where id = app;

  select stage_changed_at into changed from applications where id = app;
  if changed < now() - interval '5 seconds' then
    raise exception 'FAIL 6: stage_changed_at not maintained';
  end if;
  if (select count(*) from audit_log where table_name = 'applications' and record_id = app and action = 'update') <= audits then
    raise exception 'FAIL 6: stage update wrote no audit_log row';
  end if;
  if not exists (select 1 from events_outbox where event_name = 'application.stage_changed' and aggregate_id = app) then
    raise exception 'FAIL 6: application.stage_changed not in events_outbox';
  end if;
  if not exists (select 1 from activities where kind = 'status_change' and application_id = app) then
    raise exception 'FAIL 6: no status_change activity for stage transition';
  end if;

  -- hired path
  select id into app from applications where display_code = 'APP-0006';  -- stage 'offer'
  update applications set stage = 'offer' where id = app and stage <> 'offer';
  update applications set stage = 'hired' where id = app;
  select hired_at into hired from applications where id = app;
  if hired is null then
    raise exception 'FAIL 6: hired_at not set on transition to hired';
  end if;
  if not exists (select 1 from events_outbox where event_name = 'application.hired' and aggregate_id = app) then
    raise exception 'FAIL 6: application.hired not in events_outbox';
  end if;
  if not exists (select 1 from events_outbox where event_name = 'application.stage_changed' and aggregate_id = app) then
    raise exception 'FAIL 6: hired transition missing application.stage_changed';
  end if;
  raise notice 'PASS 6: stage transitions write audit + outbox + activity, maintain stage_changed_at/hired_at';
end $$;

-- 7. Remaining outbox events -------------------------------------------------
do $$
declare
  item uuid; person uuid := 'b0000000-0000-4000-8000-000000000004';
begin
  -- candidate.status_changed
  update candidate_profiles
     set status_id = (select id from candidate_statuses where label = 'Sent InMail I (Linkedin)')
   where person_id = person;
  if not exists (select 1 from events_outbox where event_name = 'candidate.status_changed' and aggregate_id = person) then
    raise exception 'FAIL 7: candidate.status_changed not emitted';
  end if;

  -- requisition.status_changed (lifecycle)
  update requisitions set status = 'waiting_approval' where display_code = 'REQ-0003';
  if not exists (select 1 from events_outbox eo join requisitions r on r.id = eo.aggregate_id
                 where eo.event_name = 'requisition.status_changed' and r.display_code = 'REQ-0003') then
    raise exception 'FAIL 7: requisition.status_changed not emitted';
  end if;

  -- requisition.status_changed (approver decision)
  update requisition_approvers set decision = 'approved', decided_at = now()
   where requisition_id = 'd0000000-0000-4000-8000-000000000003';
  if (select count(*) from events_outbox eo where eo.event_name = 'requisition.status_changed'
        and eo.aggregate_id = 'd0000000-0000-4000-8000-000000000003') < 2 then
    raise exception 'FAIL 7: approver decision did not emit requisition.status_changed';
  end if;

  -- deal.stage_changed
  update deals set stage = 'negotiation' where display_code = 'DEAL-0001';
  if not exists (select 1 from events_outbox where event_name = 'deal.stage_changed'
                 and aggregate_id = 'e0000000-0000-4000-8000-000000000001') then
    raise exception 'FAIL 7: deal.stage_changed not emitted';
  end if;

  -- intake_item.received / imported
  insert into intake_items (channel, target_type, full_name, status)
  values ('manual', 'candidate', 'Validation Person', 'pending')
  returning id into item;
  if not exists (select 1 from events_outbox where event_name = 'intake_item.received' and aggregate_id = item) then
    raise exception 'FAIL 7: intake_item.received not emitted';
  end if;
  update intake_items set status = 'imported', person_id = person where id = item;
  if not exists (select 1 from events_outbox where event_name = 'intake_item.imported' and aggregate_id = item) then
    raise exception 'FAIL 7: intake_item.imported not emitted';
  end if;

  -- activity.logged
  if not exists (select 1 from events_outbox where event_name = 'activity.logged') then
    raise exception 'FAIL 7: activity.logged never emitted';
  end if;
  raise notice 'PASS 7: all trigger-fired domain events reach events_outbox';
end $$;

-- 8. reminder.due via fn_fire_due_reminders ------------------------------------
do $$
declare
  rem uuid; fired int;
begin
  insert into reminders (staff_id, subject, remind_at, status)
  values ('a0000000-0000-4000-8000-000000000002', 'Validation overdue reminder', now() - interval '1 hour', 'pending')
  returning id into rem;
  fired := public.fn_fire_due_reminders();
  if fired < 1 then
    raise exception 'FAIL 8: fn_fire_due_reminders fired % rows', fired;
  end if;
  if (select status from reminders where id = rem) <> 'fired' then
    raise exception 'FAIL 8: overdue reminder not flipped to fired';
  end if;
  if not exists (select 1 from events_outbox where event_name = 'reminder.due' and aggregate_id = rem) then
    raise exception 'FAIL 8: reminder.due not in events_outbox';
  end if;
  raise notice 'PASS 8: reminder.due fires, reminder status flips to fired (pg_cron schedules this in prod)';
end $$;

-- 9. Seed counts ---------------------------------------------------------------
do $$
begin
  -- Counts updated 2026-09-01 for migration 20260725000006, which seeds the
  -- Zoho lookup values: sources 7 -> 12, candidate_statuses 4 -> 18. Both
  -- verified against the live project on 2026-09-01.
  if (select count(*) from sources) <> 12 then raise exception 'FAIL 9: sources count'; end if;
  if (select count(*) from candidate_statuses) <> 18 then raise exception 'FAIL 9: candidate_statuses count'; end if;
  -- Assert the ORIGINAL four labels are intact and still first in sort order,
  -- rather than pinning the whole list. candidate_statuses is admin-editable by
  -- design (architecture section 2.2), so asserting an exact full list would
  -- break the moment an admin adds a status, which is sanctioned behaviour.
  -- What actually matters is the invariant that seeded labels are never
  -- renamed, so migrated history stays readable in the team's own vocabulary.
  if (select array_agg(label order by sort_order) from (
        select label, sort_order from candidate_statuses order by sort_order limit 4
      ) t)
     <> array['Resume Provided by Third Party', 'Candidate to Review Info', 'Sent InMail I (Linkedin)', 'Placed'] then
    raise exception 'FAIL 9: the four originally seeded candidate_statuses labels were renamed or reordered';
  end if;
  if not exists (select 1 from staff where email = 'john@ventvest.com' and role = 'admin' and is_active) then
    raise exception 'FAIL 9: admin staff row for john@ventvest.com missing';
  end if;
  if (select count(*) from staff) <> 4 then raise exception 'FAIL 9: staff count'; end if;
  if (select count(*) from companies where is_test) <> 5 then raise exception 'FAIL 9: companies count'; end if;
  if (select count(*) from people where is_test) <> 10 then raise exception 'FAIL 9: people count'; end if;
  if (select count(*) from candidate_profiles) <> 7 then raise exception 'FAIL 9: candidate_profiles count'; end if;
  if (select count(*) from contact_profiles) <> 5 then raise exception 'FAIL 9: contact_profiles count'; end if;
  if (select count(*) from requisitions where display_code <= 'REQ-0003') <> 3 then raise exception 'FAIL 9: requisitions count'; end if;
  if (select count(*) from applications where display_code <= 'APP-0008') <> 8 then raise exception 'FAIL 9: applications count'; end if;
  if (select count(*) from deals) <> 2 then raise exception 'FAIL 9: deals count'; end if;
  raise notice 'PASS 9: seed rows all present (12 sources, 18 statuses, 4 staff, 5 companies, 10 people, 3 reqs, 8 apps, 2 deals)';
end $$;

-- 10-13. RLS behavior, simulated via role + request.jwt.claims -----------------
-- Personas: Rita recruiter ...0002, Sam sourcer ...0003, Ben bd ...0004, John admin ...0001.

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from people;
  if n <> 3 then raise exception 'FAIL 10: sourcer sees % people, expected 3 own-sourced', n; end if;
  select count(*) into n from candidate_profiles where sourcer_id <> auth.uid();
  if n <> 0 then raise exception 'FAIL 10: sourcer sees others'' candidate_profiles'; end if;
  select count(*) into n from companies;
  if n <> 0 then raise exception 'FAIL 10: sourcer sees % companies, expected 0', n; end if;
  select count(*) into n from requisitions;
  if n < 3 then raise exception 'FAIL 10: sourcer cannot read requisitions'; end if;
  select count(*) into n from audit_log;
  if n <> 0 then raise exception 'FAIL 10: sourcer can read audit_log'; end if;
  -- grade guard: non-grade column update must fail
  declare guard_hit boolean := false;
  begin
    begin
      update candidate_profiles set current_title = 'Hacked'
       where person_id = 'b0000000-0000-4000-8000-000000000001';
    exception when raise_exception then guard_hit := true;
    end;
    if not guard_hit then
      raise exception 'FAIL 10: sourcer updated a non-grade column';
    end if;
  end;
  update candidate_profiles set star_grade = 2, grade_comment = 'Regraded by sourcer'
   where person_id = 'b0000000-0000-4000-8000-000000000001';
  if not found then raise exception 'FAIL 10: sourcer could not update own grade fields'; end if;
  -- intake: own candidate rows ok, contact rows denied
  insert into intake_items (channel, target_type, full_name, submitted_by)
  values ('linkedin_url', 'candidate', 'Sourcer Intake OK', 'a0000000-0000-4000-8000-000000000003');
  begin
    insert into intake_items (channel, target_type, full_name, submitted_by)
    values ('linkedin_url', 'contact', 'Should Fail', 'a0000000-0000-4000-8000-000000000003');
    raise exception 'FAIL 10: sourcer inserted a contact intake item';
  exception when insufficient_privilege or check_violation then null;
  end;
  raise notice 'PASS 10: sourcer boundary (own candidates only, grade fields only, no companies/audit, candidate intake only)';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from people;
  if n <> 5 then raise exception 'FAIL 11: bd sees % people, expected 5 with contact_profiles', n; end if;
  -- candidate-only person invisible
  select count(*) into n from people where id = 'b0000000-0000-4000-8000-000000000001';
  if n <> 0 then raise exception 'FAIL 11: bd sees a candidate-only person'; end if;
  -- dual-profile person visible, candidate fields not
  select count(*) into n from people where id = 'b0000000-0000-4000-8000-000000000009';
  if n <> 1 then raise exception 'FAIL 11: bd cannot see dual-profile person'; end if;
  select count(*) into n from candidate_profiles;
  if n <> 0 then raise exception 'FAIL 11: bd can read candidate_profiles'; end if;
  select count(*) into n from requisitions;
  if n <> 0 then raise exception 'FAIL 11: bd can read requisitions'; end if;
  select count(*) into n from intake_items where target_type = 'candidate';
  if n <> 0 then raise exception 'FAIL 11: bd sees candidate intake items'; end if;
  update deals set probability = 0.6 where display_code = 'DEAL-0001';
  if not found then raise exception 'FAIL 11: bd could not update a deal'; end if;
  raise notice 'PASS 11: bd boundary (contact people only, no candidate data, no requisitions, deals writable)';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from people;
  if n <> 10 then raise exception 'FAIL 12: recruiter sees % people, expected all 10', n; end if;
  update deals set probability = 0.9 where display_code = 'DEAL-0001';
  if found then raise exception 'FAIL 12: recruiter updated a deal'; end if;
  select count(*) into n from deals;
  if n <> 2 then raise exception 'FAIL 12: recruiter cannot read deals'; end if;
  select count(*) into n from audit_log;
  if n <> 0 then raise exception 'FAIL 12: recruiter can read audit_log'; end if;
  -- intake: full on candidate, read-only on contact
  insert into intake_items (channel, target_type, full_name, submitted_by)
  values ('manual', 'candidate', 'Recruiter Intake OK', 'a0000000-0000-4000-8000-000000000002');
  begin
    insert into intake_items (channel, target_type, full_name, submitted_by)
    values ('manual', 'contact', 'Should Fail', 'a0000000-0000-4000-8000-000000000002');
    raise exception 'FAIL 12: recruiter inserted a contact intake item';
  exception when insufficient_privilege or check_violation then null;
  end;
  raise notice 'PASS 12: recruiter boundary (all people, deals read-only, no audit_log, candidate intake full / contact read)';
end $$;
reset role;

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', false);
set role authenticated;
do $$
declare n int;
begin
  select count(*) into n from audit_log;
  if n = 0 then raise exception 'FAIL 13: admin cannot read audit_log'; end if;
  select count(*) into n from events_outbox where processed_at is null;
  if n = 0 then raise exception 'FAIL 13: admin cannot read events_outbox'; end if;
  select count(*) into n from people;
  if n <> 10 then raise exception 'FAIL 13: admin does not see all people'; end if;
  raise notice 'PASS 13: admin reads audit_log, events_outbox, and all people';
end $$;
reset role;
select set_config('request.jwt.claims', '', false);

-- 14. is_test purge runs clean (rolled back) -----------------------------------
begin;
delete from people where is_test;
delete from requisitions where is_test;
delete from deals where is_test;
delete from companies where is_test;
do $$
begin
  if (select count(*) from people where is_test) <> 0
     or (select count(*) from companies where is_test) <> 0
     or (select count(*) from requisitions where is_test) <> 0
     or (select count(*) from deals where is_test) <> 0 then
    raise exception 'FAIL 14: is_test rows survive purge';
  end if;
  raise notice 'PASS 14: is_test purge deletes clean across people/requisitions/deals/companies (rolled back)';
end $$;
rollback;

-- 15. Teardown ---------------------------------------------------------------
-- Checks 7, 8, 10 and 12 insert rows to prove the outbox triggers and the
-- sourcer/recruiter RLS boundaries. They are removed here rather than inline
-- because 10 and 12 run under an impersonated role whose DELETE policy does not
-- cover them. Left behind, they accumulated one row per check per run and
-- skewed dash.data_quality_dedup_rate, whose denominator is the week's intake.
do $$
declare
  removed int;
begin
  delete from intake_items
   where full_name in ('Validation Person', 'Sourcer Intake OK', 'Recruiter Intake OK', 'Should Fail');
  get diagnostics removed = row_count;
  raise notice 'PASS 15: teardown removed % validation intake_items row(s)', removed;

  delete from reminders where subject = 'Validation overdue reminder';
  get diagnostics removed = row_count;
  raise notice 'PASS 15: teardown removed % validation reminder(s)', removed;
end $$;

do $$ begin raise notice 'VALIDATION COMPLETE'; end $$;
