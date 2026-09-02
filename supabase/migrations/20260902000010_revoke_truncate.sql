-- Revoke TRUNCATE, TRIGGER and REFERENCES from anon and authenticated.
--
-- Found on 2026-09-02 while adding erasure_log: every table in public granted
-- all seven privileges to authenticated, including TRUNCATE. Confirmed by
-- running `truncate erasure_log` as the authenticated role, which succeeded.
--
-- RLS does not apply to TRUNCATE. A row-level policy cannot stop it, so no
-- amount of policy work covers this. What limits the blast radius today is that
-- PostgREST never emits TRUNCATE, so a browser cannot reach it through the API.
-- The exposure is anything that runs SQL as one of those roles: a future
-- security-invoker function, a pg_net call, a direct connection with the anon
-- or authenticated role, or a Postgres extension. None of that should be one
-- mistake away from erasing people, applications and audit_log.
--
-- TRIGGER and REFERENCES go with it. Both let a role attach objects to a table
-- it does not own, neither is used by the app, and both were granted by the
-- same blanket default.
--
-- The default privileges are altered too, so a table added by a later migration
-- does not quietly inherit the grant again. Two consequences to know about.
--
-- A table created by a future migration now gets no anon or authenticated
-- grants at all, so every new table must grant what it needs explicitly. That
-- is a loud failure (the app cannot see the table) rather than a silent
-- over-grant, which is the trade wanted here.
--
-- The default privileges owned by supabase_admin cannot be changed from the
-- postgres role: `alter default privileges for role supabase_admin` fails with
-- "permission denied to change default privileges". Tables created **through
-- the dashboard** are owned by supabase_admin and would still inherit the old
-- blanket grant, so a table added that way needs this revoke run again. Tables
-- created by migrations are owned by postgres and are covered.

do $$
declare
  r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', r.tablename);
  end loop;
end $$;

alter default privileges in schema public
  revoke truncate, trigger, references, maintain on tables from anon, authenticated;
