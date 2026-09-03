-- Allow 'lead' in zoho_id_map.entity_type.
--
-- Zoho CRM Leads have no FOOS table of their own: FOOS models a prospect as a
-- person plus a contact_profiles row, and that is where the 13 leads land. They
-- could therefore have been mapped as 'contact', since the foos_id is a person
-- id either way and Zoho lead ids cannot collide with Zoho contact ids.
--
-- They get their own entity_type instead, for two reasons. Provenance: after the
-- import, nothing else records that a given person came from Leads rather than
-- Contacts, and the Zoho module is the only place that distinction exists.
-- Purge: purge-zoho-import.mjs works from this table, and a partial rollback of
-- one module is only expressible if the module is named here.
--
-- This is the same failure that migration 20260903000009 fixed for
-- 'application', where the missing value let 32,165 rows insert with no mapping
-- and no way to purge them. Adding the value before the first run of the phase
-- rather than after is the whole point.

alter table public.zoho_id_map
  drop constraint if exists zoho_id_map_entity_type_check;

alter table public.zoho_id_map
  add constraint zoho_id_map_entity_type_check
  check (
    entity_type = any (
      array[
        'candidate'::text,
        'application'::text,
        'attachment'::text,
        'note'::text,
        'requisition'::text,
        'company'::text,
        'contact'::text,
        'lead'::text,
        'deal'::text,
        'ticket'::text
      ]
    )
  );
