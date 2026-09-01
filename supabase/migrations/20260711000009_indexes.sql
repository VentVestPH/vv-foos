-- Indexes: people dedup keys, FK lookups, stage_changed_at, outbox/audit scans.

-- Dedup key: normalized primary email (first entry of the typed array), plus LinkedIn URL.
create index idx_people_primary_email on people (lower(emails -> 0 ->> 'address'));
create index idx_people_linkedin_url on people (linkedin_public_url);

create index idx_staff_manager on staff (manager_id);
create index idx_companies_owner on companies (owner_id);

create index idx_candidate_profiles_sourcer on candidate_profiles (sourcer_id);
create index idx_candidate_profiles_status on candidate_profiles (status_id);

create index idx_requisitions_company on requisitions (company_id);
create index idx_requisitions_status on requisitions (status);
create index idx_requisition_owners_staff on requisition_owners (staff_id);
create index idx_requisition_approvers_staff on requisition_approvers (staff_id);

create index idx_applications_requisition on applications (requisition_id);
create index idx_applications_person on applications (person_id);
create index idx_applications_stage_changed_at on applications (stage_changed_at);

-- Cheap "n Unviewed" count: anti-join from applications per requisition
-- against this covering index on (staff_id, application_id).
create index idx_application_views_staff on application_views (staff_id, application_id);

create index idx_intake_items_status on intake_items (status);
create index idx_intake_items_target on intake_items (target_type);
create index idx_intake_items_submitted_by on intake_items (submitted_by);
create index idx_intake_items_person on intake_items (person_id);

create index idx_contact_profiles_company on contact_profiles (company_id);
create index idx_deals_company on deals (company_id);
create index idx_deals_owner on deals (owner_id);
create index idx_deals_stage on deals (stage);
create index idx_tickets_company on tickets (company_id);
create index idx_tickets_assignee on tickets (assignee_id);

create index idx_activities_person on activities (person_id);
create index idx_activities_company on activities (company_id);
create index idx_activities_deal on activities (deal_id);
create index idx_activities_application on activities (application_id);
create index idx_activities_requisition on activities (requisition_id);
create index idx_activities_occurred on activities (occurred_at);
create index idx_activities_gmail on activities (gmail_message_id);

create index idx_tasks_assignee on tasks (assignee_id);
create index idx_tasks_related on tasks (related_type, related_id);
create index idx_reminders_staff on reminders (staff_id);
create index idx_reminders_due on reminders (remind_at) where status = 'pending';
create index idx_attachments_parent on attachments (parent_type, parent_id);

create index idx_audit_log_record on audit_log (table_name, record_id);
create index idx_events_outbox_pending on events_outbox (created_at) where processed_at is null;

create index idx_ats_saved_views_staff on ats_saved_views (staff_id);
create index idx_integration_settings_staff on integration_settings (staff_id);
