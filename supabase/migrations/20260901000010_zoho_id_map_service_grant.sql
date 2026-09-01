-- Let the Zoho importer reach zoho_id_map, without opening it to users.
--
-- The table was created in 20260725000006 with row-level security enabled and no
-- policies, which is right: nothing in the application should read it. But it was
-- created after migration 11's one-time `grant all on all tables in schema public`,
-- so it carries no privileges at all (see D33). service_role has rolbypassrls, which
-- skips the policy check but not the GRANT check, so the importer failed with
-- "permission denied for table zoho_id_map" before writing anything.
--
-- Granted to service_role only. anon and authenticated stay with no privileges, so
-- the mapping between Zoho ids and FOOS records is not reachable through PostgREST
-- by any signed-in user. That matters because the table is a join key between an
-- external system's identifiers and real people.
--
-- validate.sql check 14b lists this table as deliberately unreachable, and continues
-- to pass: the check asks about the authenticated role, which is unchanged.

grant select, insert, update, delete on public.zoho_id_map to service_role;
