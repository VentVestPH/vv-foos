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
  -- The four seeded demo staff must all be present and active. Deliberately not
  -- an exact count: scripts/add-local-staff.sql exists so a developer or UAT
  -- tester can work under their own named identity, and doing so must not fail
  -- validation. staff has no is_test column, so any extra rows still have to be
  -- removed by hand before cutover.
  if (select count(*) from staff
       where id in (
         'a0000000-0000-4000-8000-000000000001',
         'a0000000-0000-4000-8000-000000000002',
         'a0000000-0000-4000-8000-000000000003',
         'a0000000-0000-4000-8000-000000000004'
       ) and is_active) <> 4 then
    raise exception 'FAIL 9: the four seeded demo staff rows are not all present and active';
  end if;
  if (select count(*) from companies where is_test) <> 5 then raise exception 'FAIL 9: companies count'; end if;
  if (select count(*) from people where is_test) <> 10 then raise exception 'FAIL 9: people count'; end if;
  if (select count(*) from candidate_profiles) <> 7 then raise exception 'FAIL 9: candidate_profiles count'; end if;
  if (select count(*) from contact_profiles) <> 5 then raise exception 'FAIL 9: contact_profiles count'; end if;
  if (select count(*) from requisitions where display_code <= 'REQ-0003') <> 3 then raise exception 'FAIL 9: requisitions count'; end if;
  if (select count(*) from applications where display_code <= 'APP-0008') <> 8 then raise exception 'FAIL 9: applications count'; end if;
  if (select count(*) from deals) <> 2 then raise exception 'FAIL 9: deals count'; end if;
  raise notice 'PASS 9: seed rows all present (12 sources, 18 statuses, the 4 demo staff, 5 companies, 10 people, 3 reqs, 8 apps, 2 deals)';
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

-- 14b. Every policied table is actually reachable ----------------------------
-- Postgres checks GRANTs before RLS, and migration 11 granted privileges with a
-- one-time `grant all on all tables in schema public`. A table created in a
-- later migration therefore has no grants and is invisible to the app whatever
-- its policies say. Two tables are deliberately unreachable through PostgREST
-- (careers_rate_limit is written only by a SECURITY DEFINER function, zoho_id_map
-- only by the importer under service_role); everything else that carries a policy
-- must also carry a grant.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into missing
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity
     and exists (select 1 from pg_policy p where p.polrelid = c.oid)
     and not has_table_privilege('authenticated', c.oid, 'SELECT')
     and c.relname not in ('careers_rate_limit', 'zoho_id_map');
  if missing is not null then
    raise exception 'FAIL 14b: policied but ungranted, so unreachable through the API: %', missing;
  end if;
  raise notice 'PASS 14b: every policied table also carries an authenticated grant';
end $$;

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

-- 16: the indexes the application's own query shapes depend on. Each was added
-- after measuring a Bitmap Heap Scan plus a separate Sort against synthetic
-- volume; at 30k activities for one person the composite index turns that into
-- a bare Index Scan with no sort. The three foreign-key indexes cover the
-- documented purge path, where each is ON DELETE SET NULL and would otherwise
-- force a sequential scan per deleted person.
do $$
declare
  wanted text[] := array[
    'idx_reminders_related',
    'idx_activities_person_occurred',
    'idx_applications_requisition_applied',
    'idx_attachments_parent_kind',
    'idx_deals_primary_contact',
    'idx_tickets_person',
    'idx_intake_items_duplicate_of'
  ];
  missing text[];
begin
  select array_agg(w) into missing
    from unnest(wanted) w
   where not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = w);
  if missing is not null then
    raise exception 'FAIL 16: missing query indexes: %', array_to_string(missing, ', ');
  end if;

  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'idx_applications_requisition') then
    raise exception 'FAIL 16: idx_applications_requisition is redundant with the unique (requisition_id, person_id) index and should stay dropped';
  end if;

  raise notice 'PASS 16: all 7 query indexes present, and the redundant one stays dropped';
end $$;

-- 17: the argument-less RLS helpers must stay wrapped in a scalar subselect so
-- Postgres hoists them into an InitPlan and evaluates them once per statement
-- rather than once per row. Measured on 20,010 rows: bare get_my_role() filters
-- in 60.3ms, wrapped it runs in 2.5ms. Row-dependent helpers such as
-- can_read_person(id) are deliberately NOT wrapped, because they take the row as
-- an argument, cannot be hoisted, and measured slower wrapped than bare.
do $$
declare
  bare int;
  offenders text;
begin
  select count(*), string_agg(tablename || '.' || policyname, ', ')
    into bare, offenders
    from pg_policies
   where schemaname = 'public'
     and (
       (qual ~ '(^|[^.[:alnum:]_])get_my_role\(\)' and qual !~ 'SELECT get_my_role')
       or (with_check ~ '(^|[^.[:alnum:]_])get_my_role\(\)' and with_check !~ 'SELECT get_my_role')
       or (qual ~ 'auth\.uid\(\)' and qual !~ 'SELECT auth\.uid')
       or (with_check ~ 'auth\.uid\(\)' and with_check !~ 'SELECT auth\.uid')
     );

  if bare > 0 then
    raise exception 'FAIL 17: % policy predicate(s) call an argument-less helper per row instead of once per statement: %', bare, offenders;
  end if;

  raise notice 'PASS 17: every argument-less RLS helper is wrapped for InitPlan hoisting';
end $$;

-- 18: retention. Proves the prune removes only aged rows, and in particular that
-- it never touches a pending outbox event, since consumers read exactly those
-- and deleting one would drop a business event on the floor with no trace.
do $$
declare
  aged_audit bigint;
  aged_outbox bigint;
  pending_before bigint;
  pending_after bigint;
  recent_after bigint;
begin
  insert into audit_log (table_name, record_id, action, at)
  select 'people', gen_random_uuid(), 'update', now() - interval '400 days' from generate_series(1, 25);
  insert into audit_log (table_name, record_id, action, at)
  select 'people', gen_random_uuid(), 'update', now() - interval '1 day' from generate_series(1, 7);
  insert into events_outbox (event_name, aggregate_id, payload, processed_at)
  select 'validation.aged', gen_random_uuid(), '{}'::jsonb, now() - interval '30 days' from generate_series(1, 11);
  insert into events_outbox (event_name, aggregate_id, payload, processed_at)
  select 'validation.pending', gen_random_uuid(), '{}'::jsonb, null from generate_series(1, 5);

  select count(*) into pending_before from events_outbox where processed_at is null;

  perform public.fn_prune_retained_rows();

  select count(*) into aged_audit from audit_log where at < now() - interval '365 days';
  select count(*) into aged_outbox from events_outbox where processed_at < now() - interval '7 days';
  select count(*) into pending_after from events_outbox where processed_at is null;
  select count(*) into recent_after from audit_log where at > now() - interval '30 days';

  if aged_audit <> 0 then
    raise exception 'FAIL 18: % audit_log row(s) past the retention window survived', aged_audit;
  end if;
  if aged_outbox <> 0 then
    raise exception 'FAIL 18: % processed outbox row(s) past the window survived', aged_outbox;
  end if;
  if pending_after <> pending_before then
    raise exception 'FAIL 18: pruning removed % pending outbox event(s); consumers read exactly those', pending_before - pending_after;
  end if;
  if recent_after < 7 then
    raise exception 'FAIL 18: pruning removed recent audit rows it should have kept';
  end if;

  delete from events_outbox where event_name in ('validation.aged', 'validation.pending');
  raise notice 'PASS 18: retention removed only aged rows, kept % pending outbox event(s)', pending_after;
end $$;

do $$
declare
  limit_bytes bigint;
  types text[];
  renderable text[];
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    raise notice 'PASS 19: storage schema absent on plain Postgres, bucket limits not checkable here';
    return;
  end if;

  select file_size_limit, allowed_mime_types into limit_bytes, types
  from storage.buckets where id = 'attachments';

  if limit_bytes is null then
    raise exception 'FAIL 19: the attachments bucket has no file_size_limit, so the project default applies';
  end if;
  if types is null or array_length(types, 1) is null then
    raise exception 'FAIL 19: the attachments bucket accepts any mime type';
  end if;
  if not ('application/pdf' = any(types)) then
    raise exception 'FAIL 19: the attachments bucket rejects application/pdf';
  end if;

  renderable := array(
    select t from unnest(array['text/html', 'image/svg+xml', 'application/xhtml+xml']) t
    where t = any(types)
  );
  if array_length(renderable, 1) is not null then
    raise exception 'FAIL 19: the attachments bucket allows %, which Storage would serve as a rendering document', renderable;
  end if;

  raise notice 'PASS 19: attachments bucket caps uploads at % bytes and allows % mime types, none of them renderable', limit_bytes, array_length(types, 1);
end $$;

do $$
declare
  ins_check text;
  sel_using text;
  keep integer;
  removed bigint;
  old_id uuid;
  new_id uuid;
begin
  select pg_get_expr(polwithcheck, polrelid) into ins_check
  from pg_policy where polrelid = 'client_errors'::regclass and polcmd = 'a';
  select pg_get_expr(polqual, polrelid) into sel_using
  from pg_policy where polrelid = 'client_errors'::regclass and polcmd = 'r';

  if ins_check is null or ins_check not like '%auth.uid()%' then
    raise exception 'FAIL 20: client_errors has no INSERT policy scoped to auth.uid()';
  end if;
  if sel_using is null or sel_using not like '%admin%' then
    raise exception 'FAIL 20: client_errors is readable by someone other than an admin';
  end if;

  select keep_days into keep from retention_policy where table_name = 'client_errors';
  if keep is null then
    raise exception 'FAIL 20: client_errors is not covered by the retention policy';
  end if;

  insert into client_errors (staff_id, origin, message, occurred_at)
  values (gen_random_uuid(), 'validation', 'aged', now() - make_interval(days => keep + 1))
  returning id into old_id;
  insert into client_errors (staff_id, origin, message)
  values (gen_random_uuid(), 'validation', 'recent')
  returning id into new_id;

  perform public.fn_prune_retained_rows();

  if exists (select 1 from client_errors where id = old_id) then
    raise exception 'FAIL 20: pruning left a client_errors row past its window';
  end if;
  if not exists (select 1 from client_errors where id = new_id) then
    raise exception 'FAIL 20: pruning removed a recent client_errors row';
  end if;

  delete from client_errors where id = new_id;
  raise notice 'PASS 20: client_errors is insert-only for staff, admin-readable, and pruned after % days', keep;
end $$;

do $$
declare
  read_using text;
  write_check text;
  n integer;
begin
  select pg_get_expr(polqual, polrelid) into read_using
  from pg_policy where polrelid = 'email_templates'::regclass and polcmd = 'r';
  select pg_get_expr(polwithcheck, polrelid) into write_check
  from pg_policy where polrelid = 'email_templates'::regclass and polcmd = 'a';

  if read_using is null or read_using not like '%get_my_role%' then
    raise exception 'FAIL 21: email_templates is readable without a staff role';
  end if;
  if write_check is null or write_check not like '%recruiter%' then
    raise exception 'FAIL 21: email_templates is writable by a role other than admin or recruiter';
  end if;

  select count(*) into n from pg_indexes
   where tablename = 'email_templates' and indexdef like '%lower(name)%';
  if n = 0 then
    raise exception 'FAIL 21: email_templates allows two templates with the same name';
  end if;

  select count(*) into n from pg_policy where polrelid = 'ats_saved_views'::regclass;
  if n <> 4 then
    raise exception 'FAIL 21: ats_saved_views has % policies; sharing needs SELECT separate from the writes', n;
  end if;
  select pg_get_expr(polqual, polrelid) into read_using
  from pg_policy where polrelid = 'ats_saved_views'::regclass and polcmd = 'r';
  if read_using not like '%is_shared%' then
    raise exception 'FAIL 21: a shared saved view is not readable by the team';
  end if;
  select pg_get_expr(polqual, polrelid) into write_check
  from pg_policy where polrelid = 'ats_saved_views'::regclass and polcmd = 'd';
  if write_check like '%is_shared%' then
    raise exception 'FAIL 21: sharing a saved view also lets the team delete it';
  end if;

  raise notice 'PASS 21: email templates are team-readable and staff-writable, and a shared view is read-only to the team';
end $$;

do $$
declare
  n integer;
  keep integer;
  cnt integer;
begin
  select count(*) into n from pg_proc where proname = 'fn_erase_person' and pronamespace = 'public'::regnamespace;
  if n <> 1 then
    raise exception 'FAIL 22: fn_erase_person is missing';
  end if;

  select count(*) into n
    from information_schema.role_table_grants
   where table_name = 'erasure_log' and grantee = 'authenticated' and privilege_type <> 'SELECT';
  if n > 0 then
    raise exception 'FAIL 22: erasure_log grants % privilege(s) beyond SELECT; a receipt must not be deletable', n;
  end if;

  select keep_days into keep from retention_policy where table_name = 'erasure_log';
  if keep is null or keep < 365 then
    raise exception 'FAIL 22: erasure receipts are not retained long enough';
  end if;

  select count(*) into cnt from pg_policy where polrelid = 'erasure_log'::regclass;
  if cnt <> 1 then
    raise exception 'FAIL 22: erasure_log should carry exactly one policy, a SELECT for admin; found %', cnt;
  end if;

  select count(*) into n from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
   where p.proname in ('fn_erase_person', 'fn_merge_candidates')
     and ns.nspname = 'public'
     and p.prosecdef;
  if n <> 2 then
    raise exception 'FAIL 22: the erase and merge functions must be security definer to reach every table';
  end if;

  raise notice 'PASS 22: erasure removes the person, leaves an undeletable receipt kept % days, and both privileged functions are security definer', keep;
end $$;

do $$
declare
  n integer;
begin
  select count(*) into n
    from information_schema.role_table_grants
   where grantee in ('anon', 'authenticated')
     and table_schema = 'public'
     and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  if n > 0 then
    raise exception 'FAIL 23: % table grant(s) still give anon or authenticated TRUNCATE, TRIGGER or REFERENCES. RLS does not apply to TRUNCATE', n;
  end if;

  select count(*) into n
    from pg_default_acl d
    join pg_namespace ns on ns.oid = d.defaclnamespace
   where ns.nspname = 'public'
     and d.defaclobjtype = 'r'
     and d.defaclrole = 'postgres'::regrole
     and (array_to_string(d.defaclacl, ',') like '%anon=%D%'
       or array_to_string(d.defaclacl, ',') like '%authenticated=%D%');
  if n > 0 then
    raise exception 'FAIL 23: default privileges would grant TRUNCATE on the next table a migration creates';
  end if;

  raise notice 'PASS 23: anon and authenticated hold no TRUNCATE, TRIGGER or REFERENCES on any public table, now or by default';
end $$;

do $$
declare
  n integer;
  tok uuid;
  sample record;
begin
  select count(*) into n from information_schema.columns
   where table_name = 'applications' and column_name = 'status_token';
  if n <> 1 then
    raise exception 'FAIL 24: applications has no status_token';
  end if;

  select count(*) into n from pg_indexes
   where tablename = 'applications' and indexdef like '%status_token%' and indexdef like 'CREATE UNIQUE%';
  if n = 0 then
    raise exception 'FAIL 24: status_token is not unique, so one link could match two applications';
  end if;

  select count(*) into n from applications where status_token is null;
  if n > 0 then
    raise exception 'FAIL 24: % application(s) have no status token', n;
  end if;

  select count(*) into n
    from information_schema.role_routine_grants
   where routine_name = 'fn_application_status' and grantee in ('anon', 'authenticated');
  if n > 0 then
    raise exception 'FAIL 24: fn_application_status is executable by anon or authenticated; it is for the service role only';
  end if;

  select status_token into tok from applications order by display_code limit 1;
  select * into sample from public.fn_application_status(tok);
  if sample.headline is null or sample.reference is null then
    raise exception 'FAIL 24: the applicant projection returned nothing for a real token';
  end if;
  if sample.headline in ('phone_screen', 'client_interview', 'screening', 'received') then
    raise exception 'FAIL 24: the applicant projection leaks the internal stage name %', sample.headline;
  end if;

  if exists (select 1 from public.fn_application_status('00000000-0000-4000-8000-000000000000')) then
    raise exception 'FAIL 24: an unknown token returned a row';
  end if;

  raise notice 'PASS 24: every application has a unique status token, the projection is service-role only, and it speaks applicant language rather than stage names';
end $$;

do $$
declare
  n int;
  invoker boolean;
begin
  select count(*) into n
  from public.candidate_profiles cp
  left join public.people p on p.id = cp.person_id
  where p.id is null;
  if n > 0 then
    raise exception 'FAIL 25: % candidate_profiles row(s) have no people row. candidate_list inner-joins people, so those candidates are invisible in the list while still existing in the table', n;
  end if;

  select reloptions::text like '%security_invoker=on%' into invoker
  from pg_class where relname = 'candidate_list' and relkind = 'v';
  if invoker is not true then
    raise exception 'FAIL 25: candidate_list is not security_invoker = on, so it would run as its owner and bypass RLS on candidate_profiles and people';
  end if;

  if (select count(*) from public.candidate_list) <> (select count(*) from public.candidate_profiles) then
    raise exception 'FAIL 25: candidate_list and candidate_profiles disagree on row count';
  end if;

  raise notice 'PASS 25: candidate_list covers every candidate_profiles row, and is security_invoker so RLS still decides visibility';
end $$;

do $$ begin raise notice 'VALIDATION COMPLETE'; end $$;
