-- Agent 8 (QA) — gives the four seeded demo staff rows (admin/recruiter/
-- sourcer/bd, ids a0000000-...-0001..0004) real Supabase Auth sign-in via
-- email/password, so API tests can call signInWithPassword() and hit
-- PostgREST/Edge Functions with a genuine JWT instead of the
-- request.jwt.claims simulation validate.sql uses. No service-role key is
-- needed for this — direct SQL insert into auth.users/auth.identities is
-- the standard way to seed GoTrue-compatible test users when you have
-- direct Postgres access.
--
-- Password MUST be supplied via the foos.qa_test_password setting; there is no
-- default, deliberately (QA-003). Run once
-- per environment (idempotent via ON CONFLICT). Rotate or remove these
-- identities before real-user cutover (tracked as QA-003 in the defect log
-- — known operational follow-up, not a defect in the build).

do $$
declare
  -- SECURITY (QA-003): no default. This script sets real Auth passwords, and a
  -- hardcoded default meant the same known credential existed on every
  -- environment including the live project. Pass it explicitly:
  --   psql "$DB_URL" -v ON_ERROR_STOP=1 \
  --     -c "set foos.qa_test_password = 'your-value';" -f tests/fixtures/personas.sql
  test_password text := current_setting('foos.qa_test_password', true);
  persona record;
begin
  if test_password is null or test_password = '' then
    raise exception 'foos.qa_test_password is not set. See the header of this file for the command to use.';
  end if;

  for persona in
    select * from (values
      ('a0000000-0000-4000-8000-000000000001'::uuid, 'demo-admin@ventvest.test'),
      ('a0000000-0000-4000-8000-000000000002'::uuid, 'rita.demo@ventvest.com'),
      ('a0000000-0000-4000-8000-000000000003'::uuid, 'sam.demo@ventvest.com'),
      ('a0000000-0000-4000-8000-000000000004'::uuid, 'ben.demo@ventvest.com')
    ) as t(id, email)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000', persona.id, 'authenticated', 'authenticated',
      persona.email, extensions.crypt(test_password, extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '',
      false, false
    )
    on conflict (id) do update
      set encrypted_password = excluded.encrypted_password,
          email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
          updated_at = now();

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      persona.id, persona.id, persona.id::text,
      jsonb_build_object('sub', persona.id::text, 'email', persona.email),
      'email', now(), now(), now()
    )
    on conflict (provider_id, provider) do nothing;
  end loop;
  raise notice 'PASS: 4 test-persona Auth identities created/updated (admin/recruiter/sourcer/bd)';
end $$;
