-- zoho_id_map accepts the five entity types the 2026-09-09 sweep added.
--
-- The check constraint listed ten types. Importing To_Dos, Reviews, CRM Tasks,
-- CRM Events and Calendly_Invites wrote 12,164 rows into tasks and activities
-- and then failed every recordMapping call against this constraint, leaving the
-- data loaded but with no provenance and no way for purge-zoho-import.mjs to
-- reverse it. The rows are addressed by deterministic id, so re-running the
-- import records the mappings without duplicating anything.

alter table public.zoho_id_map
  drop constraint if exists zoho_id_map_entity_type_check;

alter table public.zoho_id_map
  add constraint zoho_id_map_entity_type_check check (
    entity_type = any (array[
      'candidate', 'application', 'attachment', 'note', 'requisition',
      'company', 'contact', 'lead', 'deal', 'ticket',
      'todo', 'review', 'crmTask', 'crmEvent', 'calendlyInvite'
    ]::text[])
  );
