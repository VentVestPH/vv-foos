-- Allow 'application' in zoho_id_map.entity_type.
--
-- Found mid-import on 2026-09-03. The CHECK constraint listed candidate,
-- attachment, note, requisition, company and contact, and predates the
-- Applications module being importable at all: applications were never exported
-- from Zoho before today, so nothing had ever tried to map one.
--
-- The failure mode was quiet in the worst way. Inserting the application row
-- succeeded, and only the mapping write failed, so 32,165 applications landed in
-- the table with no zoho_id_map row. Two consequences:
--
--   1. purge-zoho-import.mjs works from zoho_id_map, so it could not have
--      removed them. That is the same shape as the crash-window orphan fixed in
--      U4.1b, and the reason that fix mattered.
--   2. The importer's own "existing" check reads the map, so a resumed run could
--      not tell an imported application from a new one. The deterministic id in
--      U4.1b is what keeps that from duplicating: the retry collides with itself,
--      is treated as already present, and then records the mapping that failed
--      the first time. The 32,165 rows self-heal on resume rather than needing
--      to be deleted.
--
-- 'deal' and 'ticket' are added at the same time. Neither is imported yet, but
-- both are FOOS entities a future Zoho or other-source import would map, and
-- discovering this constraint one entity at a time in the middle of a run is not
-- a good way to find out.

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
        'deal'::text,
        'ticket'::text
      ]
    )
  );
