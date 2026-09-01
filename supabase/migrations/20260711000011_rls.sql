-- RLS: deny-by-default on every table, policies per architecture section 5.
-- Role comes from staff.role looked up by auth.uid() (JWT sub), never from a
-- client-supplied parameter. Trigger functions are security definer, so
-- audit_log / events_outbox / status_change writes bypass these policies.

-- ------------------------------------------------------------------- helpers

create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role::text from staff where id = auth.uid() and is_active;
$$;

-- People readability per role. Recruiter/BD also see profileless people they
-- created, so an insert is visible before the profile row lands.
create or replace function public.can_read_person(pid uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  r text := public.get_my_role();
begin
  if r = 'admin' then
    return true;
  elsif r = 'recruiter' then
    return exists (select 1 from candidate_profiles where person_id = pid)
        or exists (select 1 from contact_profiles where person_id = pid)
        or exists (select 1 from people p where p.id = pid and p.created_by = auth.uid()
                     and not exists (select 1 from candidate_profiles where person_id = pid)
                     and not exists (select 1 from contact_profiles where person_id = pid));
  elsif r = 'sourcer' then
    return exists (select 1 from candidate_profiles where person_id = pid and sourcer_id = auth.uid());
  elsif r = 'bd' then
    return exists (select 1 from contact_profiles where person_id = pid)
        or exists (select 1 from people p where p.id = pid and p.created_by = auth.uid()
                     and not exists (select 1 from candidate_profiles where person_id = pid)
                     and not exists (select 1 from contact_profiles where person_id = pid));
  end if;
  return false;
end $$;

-- Write access on people: recruiter owns the candidate side, bd the contact side.
create or replace function public.can_write_person(pid uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  r text := public.get_my_role();
begin
  if r = 'admin' then
    return true;
  elsif r = 'recruiter' then
    return exists (select 1 from candidate_profiles where person_id = pid)
        or exists (select 1 from people p where p.id = pid and p.created_by = auth.uid()
                     and not exists (select 1 from contact_profiles where person_id = pid));
  elsif r = 'bd' then
    return exists (select 1 from contact_profiles where person_id = pid)
        or exists (select 1 from people p where p.id = pid and p.created_by = auth.uid()
                     and not exists (select 1 from candidate_profiles where person_id = pid));
  end if;
  return false;
end $$;

-- Polymorphic parent readability for tasks/reminders/attachments.
create or replace function public.can_read_record(rtype text, rid uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  r text := public.get_my_role();
begin
  if r is null then
    return false;
  elsif r = 'admin' then
    return true;
  end if;
  return case rtype
    when 'person'      then public.can_read_person(rid)
    when 'company'     then r in ('recruiter', 'bd')
    when 'requisition' then r in ('recruiter', 'sourcer')
    when 'application' then r in ('recruiter', 'sourcer')
    when 'deal'        then r in ('recruiter', 'bd')
    when 'ticket'      then r in ('recruiter', 'bd')
    else false
  end;
end $$;

-- Column guard trigger deferred from the triggers migration (needs get_my_role).
create trigger trg_candidate_profiles_grade_guard before update on candidate_profiles
  for each row execute function public.fn_candidate_grade_guard();

-- ---------------------------------------------------------- enable RLS on all

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ------------------------------------------------------- staff (settings row)

create policy staff_select on staff for select
  using (public.get_my_role() is not null);
create policy staff_admin_insert on staff for insert
  with check (public.get_my_role() = 'admin');
create policy staff_admin_update on staff for update
  using (public.get_my_role() = 'admin');
create policy staff_admin_delete on staff for delete
  using (public.get_my_role() = 'admin');

-- --------------------------------------------------- sources / candidate_statuses

create policy sources_select on sources for select
  using (public.get_my_role() is not null);
create policy sources_admin_write on sources for all
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

create policy candidate_statuses_select on candidate_statuses for select
  using (public.get_my_role() is not null);
create policy candidate_statuses_admin_write on candidate_statuses for all
  using (public.get_my_role() = 'admin') with check (public.get_my_role() = 'admin');

-- -------------------------------------------------------------------- people

create policy people_select on people for select
  using (public.can_read_person(id));
create policy people_insert on people for insert
  with check (public.get_my_role() in ('admin', 'recruiter', 'bd'));
create policy people_update on people for update
  using (public.can_write_person(id));
create policy people_delete on people for delete
  using (public.can_write_person(id));

-- -------------------------------------------------------- candidate_profiles
-- admin/recruiter full; sourcer own-sourced rows (grade columns guarded by
-- trg_candidate_profiles_grade_guard); bd none.

create policy candidate_profiles_select on candidate_profiles for select
  using (public.get_my_role() in ('admin', 'recruiter')
         or (public.get_my_role() = 'sourcer' and sourcer_id = auth.uid()));
create policy candidate_profiles_insert on candidate_profiles for insert
  with check (public.get_my_role() in ('admin', 'recruiter'));
create policy candidate_profiles_update on candidate_profiles for update
  using (public.get_my_role() in ('admin', 'recruiter')
         or (public.get_my_role() = 'sourcer' and sourcer_id = auth.uid()));
create policy candidate_profiles_delete on candidate_profiles for delete
  using (public.get_my_role() in ('admin', 'recruiter'));

-- ---------------------------------------------------------- contact_profiles

create policy contact_profiles_select on contact_profiles for select
  using (public.get_my_role() in ('admin', 'recruiter', 'bd'));
create policy contact_profiles_write on contact_profiles for all
  using (public.get_my_role() in ('admin', 'bd'))
  with check (public.get_my_role() in ('admin', 'bd'));

-- ----------------------------------------------------------------- companies

create policy companies_select on companies for select
  using (public.get_my_role() in ('admin', 'recruiter', 'bd'));
create policy companies_write on companies for all
  using (public.get_my_role() in ('admin', 'bd'))
  with check (public.get_my_role() in ('admin', 'bd'));

-- ------------------------------------- requisitions, applications and satellites

create policy requisitions_select on requisitions for select
  using (public.get_my_role() in ('admin', 'recruiter', 'sourcer'));
create policy requisitions_write on requisitions for all
  using (public.get_my_role() in ('admin', 'recruiter'))
  with check (public.get_my_role() in ('admin', 'recruiter'));

create policy requisition_owners_select on requisition_owners for select
  using (public.get_my_role() in ('admin', 'recruiter', 'sourcer'));
create policy requisition_owners_write on requisition_owners for all
  using (public.get_my_role() in ('admin', 'recruiter'))
  with check (public.get_my_role() in ('admin', 'recruiter'));

create policy requisition_approvers_select on requisition_approvers for select
  using (public.get_my_role() in ('admin', 'recruiter', 'sourcer'));
create policy requisition_approvers_write on requisition_approvers for all
  using (public.get_my_role() in ('admin', 'recruiter'))
  with check (public.get_my_role() in ('admin', 'recruiter'));

create policy applications_select on applications for select
  using (public.get_my_role() in ('admin', 'recruiter', 'sourcer'));
create policy applications_write on applications for all
  using (public.get_my_role() in ('admin', 'recruiter'))
  with check (public.get_my_role() in ('admin', 'recruiter'));

-- Own view markers only, for anyone who can read applications.
create policy application_views_select on application_views for select
  using (public.get_my_role() = 'admin' or staff_id = auth.uid());
create policy application_views_upsert on application_views for insert
  with check (staff_id = auth.uid() and public.get_my_role() in ('admin', 'recruiter', 'sourcer'));
create policy application_views_update on application_views for update
  using (staff_id = auth.uid());
create policy application_views_delete on application_views for delete
  using (public.get_my_role() = 'admin' or staff_id = auth.uid());

-- -------------------------------------------------------------- intake_items
-- Split by target_type: candidate rows to ATS roles, contact rows to CRM roles.

create policy intake_items_select on intake_items for select
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'recruiter')  -- full on candidate, read on contact
    or (public.get_my_role() = 'sourcer' and target_type = 'candidate' and submitted_by = auth.uid())
    or (public.get_my_role() = 'bd' and target_type = 'contact')
  );
create policy intake_items_insert on intake_items for insert
  with check (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'recruiter' and target_type = 'candidate')
    or (public.get_my_role() = 'sourcer' and target_type = 'candidate' and submitted_by = auth.uid())
    or (public.get_my_role() = 'bd' and target_type = 'contact')
  );
create policy intake_items_update on intake_items for update
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'recruiter' and target_type = 'candidate')
    or (public.get_my_role() = 'sourcer' and target_type = 'candidate' and submitted_by = auth.uid())
    or (public.get_my_role() = 'bd' and target_type = 'contact')
  );
create policy intake_items_delete on intake_items for delete
  using (
    public.get_my_role() = 'admin'
    or (public.get_my_role() = 'recruiter' and target_type = 'candidate')
    or (public.get_my_role() = 'sourcer' and target_type = 'candidate' and submitted_by = auth.uid())
    or (public.get_my_role() = 'bd' and target_type = 'contact')
  );

-- ------------------------------------------------------------- deals, tickets

create policy deals_select on deals for select
  using (public.get_my_role() in ('admin', 'recruiter', 'bd'));
create policy deals_write on deals for all
  using (public.get_my_role() in ('admin', 'bd'))
  with check (public.get_my_role() in ('admin', 'bd'));

create policy tickets_select on tickets for select
  using (public.get_my_role() in ('admin', 'recruiter', 'bd'));
create policy tickets_write on tickets for all
  using (public.get_my_role() in ('admin', 'bd'))
  with check (public.get_my_role() in ('admin', 'bd'));

-- ---------------------------------------------------------------- activities
-- Visible/writable where any linked parent is readable; unlinked rows to creator.

create or replace function public.can_access_activity(
  p_person uuid, p_company uuid, p_deal uuid, p_application uuid, p_requisition uuid, p_creator uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  if public.get_my_role() = 'admin' then return true; end if;
  return (p_person is not null and public.can_read_person(p_person))
      or (p_company is not null and public.can_read_record('company', p_company))
      or (p_deal is not null and public.can_read_record('deal', p_deal))
      or (p_application is not null and public.can_read_record('application', p_application))
      or (p_requisition is not null and public.can_read_record('requisition', p_requisition))
      or (p_person is null and p_company is null and p_deal is null
          and p_application is null and p_requisition is null and p_creator = auth.uid());
end $$;

create policy activities_all on activities for all
  using (public.can_access_activity(person_id, company_id, deal_id, application_id, requisition_id, created_by))
  with check (public.can_access_activity(person_id, company_id, deal_id, application_id, requisition_id, created_by));

-- --------------------------------------------------- tasks, reminders, attachments

create policy tasks_all on tasks for all
  using (public.get_my_role() = 'admin' or assignee_id = auth.uid()
         or (related_type is not null and public.can_read_record(related_type, related_id)))
  with check (public.get_my_role() = 'admin' or assignee_id = auth.uid()
         or (related_type is not null and public.can_read_record(related_type, related_id)));

create policy reminders_select on reminders for select
  using (public.get_my_role() = 'admin' or staff_id = auth.uid());
create policy reminders_insert on reminders for insert
  with check (public.get_my_role() = 'admin'
              or (staff_id = auth.uid()
                  and (related_type is null or public.can_read_record(related_type, related_id))));
create policy reminders_update on reminders for update
  using (public.get_my_role() = 'admin' or staff_id = auth.uid());
create policy reminders_delete on reminders for delete
  using (public.get_my_role() = 'admin' or staff_id = auth.uid());

create policy attachments_all on attachments for all
  using (public.get_my_role() = 'admin' or public.can_read_record(parent_type, parent_id))
  with check (public.get_my_role() = 'admin' or public.can_read_record(parent_type, parent_id));

-- --------------------------------------------------------- audit / outbox

create policy audit_log_admin_select on audit_log for select
  using (public.get_my_role() = 'admin');
-- No insert/update/delete policies: only security definer triggers write.

create policy events_outbox_admin_select on events_outbox for select
  using (public.get_my_role() = 'admin');
-- Edge Function consumers use the service role, which bypasses RLS.

-- ------------------------------------------------------ approved additions

create policy ats_saved_views_all on ats_saved_views for all
  using (public.get_my_role() = 'admin' or staff_id = auth.uid())
  with check (public.get_my_role() = 'admin' or staff_id = auth.uid());

create policy intake_mapping_templates_select on intake_mapping_templates for select
  using (public.get_my_role() is not null);
create policy intake_mapping_templates_write on intake_mapping_templates for all
  using (public.get_my_role() = 'admin' or created_by = auth.uid())
  with check (public.get_my_role() = 'admin' or created_by = auth.uid());

create policy integration_settings_select on integration_settings for select
  using (public.get_my_role() = 'admin' or staff_id = auth.uid()
         or (staff_id is null and public.get_my_role() is not null));
create policy integration_settings_write on integration_settings for all
  using (public.get_my_role() = 'admin' or staff_id = auth.uid())
  with check (public.get_my_role() = 'admin' or staff_id = auth.uid());

-- -------------------------------------------------------------------- grants
-- Supabase grants these by default; conditional so plain Postgres also works.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated, service_role;
    grant all on all tables in schema public to authenticated, service_role;
    grant usage, select on all sequences in schema public to authenticated, service_role;
    grant execute on all functions in schema public to authenticated, service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant usage on schema public to anon;
    -- anon gets no table grants: the careers apply path goes through a
    -- service-role Edge Function, never a direct anonymous insert.
  end if;
end $$;
