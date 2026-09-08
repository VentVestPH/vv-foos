-- Revoke TRUNCATE from the default privileges of every owner a migration or the
-- dashboard can create a table as, not just whichever role happens to be
-- running this file.
--
-- 20260902000010 ends with a bare
--   alter default privileges in schema public revoke ... from anon, authenticated;
-- and a bare ALTER DEFAULT PRIVILEGES only touches the defaults of the role
-- executing it. That is why validate.sql check 23 passes on a plain-Postgres
-- database and on this machine's long-lived stack, and failed on a fresh
-- Supabase stack in CI on 2026-09-08:
--   ERROR: FAIL 23: default privileges would grant TRUNCATE on the next table
--          a migration creates
-- The plain-Postgres job passes because local_shim.sql creates anon and
-- authenticated with no default ACLs at all, so there is nothing to inherit.
--
-- On a fresh Supabase stack the arwdDxtm default for anon and authenticated is
-- attached to postgres and to supabase_admin, and the CLI does not necessarily
-- apply migrations as postgres, so the revoke can land on a third role's
-- defaults and leave the real ones intact. Naming the owners explicitly removes
-- the guess.
--
-- supabase_admin's defaults cannot be altered from a less privileged role, which
-- 20260902000010's own comment records. That is not fatal here: the statement is
-- attempted per owner and an insufficient_privilege is reported and skipped, so
-- the migration is safe on the hosted project and on a local stack alike.

do $$
declare
  r record;
begin
  for r in
    select rolname from pg_roles where rolname in ('postgres', 'supabase_admin')
  loop
    begin
      execute format(
        'alter default privileges for role %I in schema public '
        'revoke truncate, trigger, references, maintain on tables from anon, authenticated',
        r.rolname
      );
    exception
      when insufficient_privilege then
        raise notice 'default privileges for % left as they are: %', r.rolname, sqlerrm;
    end;
  end loop;
end $$;
