-- 51 policies rewritten so the argument-less helpers evaluate once per
-- statement instead of once per row. Measured on 20,010 rows: a bare
-- get_my_role() comparison filters in 60.3ms; the same predicate wrapped in a
-- scalar subselect plans as an InitPlan and runs in 2.5ms.
--
-- Row-dependent helpers are deliberately left bare. can_read_person(id) and its
-- siblings take the row as an argument so they cannot be hoisted, and wrapping
-- one measured 187.5ms against 179.8ms bare, which is slower.

drop policy if exists application_views_delete on public.application_views;
create policy application_views_delete on public.application_views
  as permissive
  for delete
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists application_views_select on public.application_views;
create policy application_views_select on public.application_views
  as permissive
  for select
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists application_views_update on public.application_views;
create policy application_views_update on public.application_views
  as permissive
  for update
  to public
  using ((staff_id = ( SELECT auth.uid() )));

drop policy if exists application_views_upsert on public.application_views;
create policy application_views_upsert on public.application_views
  as permissive
  for insert
  to public
  with check (((staff_id = ( SELECT auth.uid() )) AND (( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'sourcer'::text]))));

drop policy if exists applications_select on public.applications;
create policy applications_select on public.applications
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'sourcer'::text])));

drop policy if exists applications_write on public.applications;
create policy applications_write on public.applications
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists ats_saved_views_all on public.ats_saved_views;
create policy ats_saved_views_all on public.ats_saved_views
  as permissive
  for all
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))))
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists attachment_deletion_queue_admin on public.attachment_deletion_queue;
create policy attachment_deletion_queue_admin on public.attachment_deletion_queue
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text))
  with check ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists attachments_all on public.attachments;
create policy attachments_all on public.attachments
  as permissive
  for all
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR can_read_record(parent_type, parent_id)))
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR can_read_record(parent_type, parent_id)));

drop policy if exists audit_log_admin_select on public.audit_log;
create policy audit_log_admin_select on public.audit_log
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists candidate_profiles_delete on public.candidate_profiles;
create policy candidate_profiles_delete on public.candidate_profiles
  as permissive
  for delete
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists candidate_profiles_insert on public.candidate_profiles;
create policy candidate_profiles_insert on public.candidate_profiles
  as permissive
  for insert
  to public
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists candidate_profiles_select on public.candidate_profiles;
create policy candidate_profiles_select on public.candidate_profiles
  as permissive
  for select
  to public
  using (((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (sourcer_id = ( SELECT auth.uid() )))));

drop policy if exists candidate_profiles_update on public.candidate_profiles;
create policy candidate_profiles_update on public.candidate_profiles
  as permissive
  for update
  to public
  using (((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (sourcer_id = ( SELECT auth.uid() )))));

drop policy if exists candidate_statuses_admin_write on public.candidate_statuses;
create policy candidate_statuses_admin_write on public.candidate_statuses
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text))
  with check ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists candidate_statuses_select on public.candidate_statuses;
create policy candidate_statuses_select on public.candidate_statuses
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) IS NOT NULL));

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'bd'::text])));

drop policy if exists companies_write on public.companies;
create policy companies_write on public.companies
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])));

drop policy if exists contact_profiles_select on public.contact_profiles;
create policy contact_profiles_select on public.contact_profiles
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'bd'::text])));

drop policy if exists contact_profiles_write on public.contact_profiles;
create policy contact_profiles_write on public.contact_profiles
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])));

drop policy if exists deals_select on public.deals;
create policy deals_select on public.deals
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'bd'::text])));

drop policy if exists deals_write on public.deals;
create policy deals_write on public.deals
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])));

drop policy if exists events_outbox_admin_select on public.events_outbox;
create policy events_outbox_admin_select on public.events_outbox
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists intake_items_delete on public.intake_items;
create policy intake_items_delete on public.intake_items
  as permissive
  for delete
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR ((( SELECT get_my_role() ) = 'recruiter'::text) AND (target_type = 'candidate'::intake_target_type)) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (target_type = 'candidate'::intake_target_type) AND (submitted_by = ( SELECT auth.uid() ))) OR ((( SELECT get_my_role() ) = 'bd'::text) AND (target_type = 'contact'::intake_target_type))));

drop policy if exists intake_items_insert on public.intake_items;
create policy intake_items_insert on public.intake_items
  as permissive
  for insert
  to public
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR ((( SELECT get_my_role() ) = 'recruiter'::text) AND (target_type = 'candidate'::intake_target_type)) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (target_type = 'candidate'::intake_target_type) AND (submitted_by = ( SELECT auth.uid() ))) OR ((( SELECT get_my_role() ) = 'bd'::text) AND (target_type = 'contact'::intake_target_type))));

drop policy if exists intake_items_select on public.intake_items;
create policy intake_items_select on public.intake_items
  as permissive
  for select
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (( SELECT get_my_role() ) = 'recruiter'::text) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (target_type = 'candidate'::intake_target_type) AND (submitted_by = ( SELECT auth.uid() ))) OR ((( SELECT get_my_role() ) = 'bd'::text) AND (target_type = 'contact'::intake_target_type))));

drop policy if exists intake_items_update on public.intake_items;
create policy intake_items_update on public.intake_items
  as permissive
  for update
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR ((( SELECT get_my_role() ) = 'recruiter'::text) AND (target_type = 'candidate'::intake_target_type)) OR ((( SELECT get_my_role() ) = 'sourcer'::text) AND (target_type = 'candidate'::intake_target_type) AND (submitted_by = ( SELECT auth.uid() ))) OR ((( SELECT get_my_role() ) = 'bd'::text) AND (target_type = 'contact'::intake_target_type))));

drop policy if exists intake_mapping_templates_select on public.intake_mapping_templates;
create policy intake_mapping_templates_select on public.intake_mapping_templates
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) IS NOT NULL));

drop policy if exists intake_mapping_templates_write on public.intake_mapping_templates;
create policy intake_mapping_templates_write on public.intake_mapping_templates
  as permissive
  for all
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (created_by = ( SELECT auth.uid() ))))
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR (created_by = ( SELECT auth.uid() ))));

drop policy if exists integration_settings_select on public.integration_settings;
create policy integration_settings_select on public.integration_settings
  as permissive
  for select
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() )) OR ((staff_id IS NULL) AND (( SELECT get_my_role() ) IS NOT NULL))));

drop policy if exists integration_settings_write on public.integration_settings;
create policy integration_settings_write on public.integration_settings
  as permissive
  for all
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))))
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists people_insert on public.people;
create policy people_insert on public.people
  as permissive
  for insert
  to public
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'bd'::text])));

drop policy if exists reminders_delete on public.reminders;
create policy reminders_delete on public.reminders
  as permissive
  for delete
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists reminders_insert on public.reminders;
create policy reminders_insert on public.reminders
  as permissive
  for insert
  to public
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR ((staff_id = ( SELECT auth.uid() )) AND ((related_type IS NULL) OR can_read_record(related_type, related_id)))));

drop policy if exists reminders_select on public.reminders;
create policy reminders_select on public.reminders
  as permissive
  for select
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists reminders_update on public.reminders;
create policy reminders_update on public.reminders
  as permissive
  for update
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (staff_id = ( SELECT auth.uid() ))));

drop policy if exists requisition_approvers_select on public.requisition_approvers;
create policy requisition_approvers_select on public.requisition_approvers
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'sourcer'::text])));

drop policy if exists requisition_approvers_write on public.requisition_approvers;
create policy requisition_approvers_write on public.requisition_approvers
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists requisition_owners_select on public.requisition_owners;
create policy requisition_owners_select on public.requisition_owners
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'sourcer'::text])));

drop policy if exists requisition_owners_write on public.requisition_owners;
create policy requisition_owners_write on public.requisition_owners
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists requisitions_select on public.requisitions;
create policy requisitions_select on public.requisitions
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'sourcer'::text])));

drop policy if exists requisitions_write on public.requisitions;
create policy requisitions_write on public.requisitions
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text])));

drop policy if exists sources_admin_write on public.sources;
create policy sources_admin_write on public.sources
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text))
  with check ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists sources_select on public.sources;
create policy sources_select on public.sources
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) IS NOT NULL));

drop policy if exists staff_admin_delete on public.staff;
create policy staff_admin_delete on public.staff
  as permissive
  for delete
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists staff_admin_insert on public.staff;
create policy staff_admin_insert on public.staff
  as permissive
  for insert
  to public
  with check ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists staff_admin_update on public.staff;
create policy staff_admin_update on public.staff
  as permissive
  for update
  to public
  using ((( SELECT get_my_role() ) = 'admin'::text));

drop policy if exists staff_select on public.staff;
create policy staff_select on public.staff
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) IS NOT NULL));

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks
  as permissive
  for all
  to public
  using (((( SELECT get_my_role() ) = 'admin'::text) OR (assignee_id = ( SELECT auth.uid() )) OR ((related_type IS NOT NULL) AND can_read_record(related_type, related_id))))
  with check (((( SELECT get_my_role() ) = 'admin'::text) OR (assignee_id = ( SELECT auth.uid() )) OR ((related_type IS NOT NULL) AND can_read_record(related_type, related_id))));

drop policy if exists tickets_select on public.tickets;
create policy tickets_select on public.tickets
  as permissive
  for select
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'recruiter'::text, 'bd'::text])));

drop policy if exists tickets_write on public.tickets;
create policy tickets_write on public.tickets
  as permissive
  for all
  to public
  using ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])))
  with check ((( SELECT get_my_role() ) = ANY (ARRAY['admin'::text, 'bd'::text])));

