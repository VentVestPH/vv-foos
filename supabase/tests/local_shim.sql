-- LOCAL VALIDATION ONLY. Stand-in for schemas and roles Supabase manages.
-- Never run this on the hosted project: auth.uid() and the anon/authenticated/
-- service_role roles already exist there. Run before the migrations on plain
-- Postgres so migration references to auth.uid() resolve.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- Mirrors Supabase: uid from the JWT 'sub' claim. Locally the claim is set with
-- set_config('request.jwt.claims', '{"sub":"<uuid>"}', true).
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select ((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb;
$$;
