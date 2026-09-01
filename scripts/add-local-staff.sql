-- Create a named local account: an auth.users row plus the matching staff row.
--
-- The staff row's id MUST equal the auth.users id, because get_my_role() looks
-- up staff by auth.uid(). There is no foreign key enforcing it (so migrations
-- stay runnable on plain Postgres), so this script sets both from one value.
--
-- LOCAL ONLY. Never run against the hosted project: it writes a password
-- directly into auth.users, and staff has no is_test column, so a row created
-- here has to be deleted by hand before cutover.
--
-- Usage:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 \
--     -c "set foos.new_staff_email = 'you@ventvest.com';" \
--     -c "set foos.new_staff_name  = 'Your Name';" \
--     -c "set foos.new_staff_role  = 'admin';" \
--     -c "set foos.new_staff_password = 'choose-one';" \
--     -f scripts/add-local-staff.sql

do $$
declare
  v_email text := current_setting('foos.new_staff_email', true);
  v_name text := current_setting('foos.new_staff_name', true);
  v_role text := current_setting('foos.new_staff_role', true);
  v_password text := current_setting('foos.new_staff_password', true);
  v_id uuid;
begin
  if coalesce(v_email, '') = '' or coalesce(v_name, '') = ''
     or coalesce(v_role, '') = '' or coalesce(v_password, '') = '' then
    raise exception 'Set foos.new_staff_email, _name, _role and _password. See the header of this file.';
  end if;
  if v_role not in ('admin', 'recruiter', 'sourcer', 'bd') then
    raise exception 'role must be one of admin, recruiter, sourcer, bd; got %', v_role;
  end if;

  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      is_super_admin, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_email, crypt(v_password, gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '',
      false, false
    );
    insert into auth.identities (
      provider_id, id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, gen_random_uuid(), v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
       set encrypted_password = crypt(v_password, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           updated_at = now()
     where id = v_id;
  end if;

  insert into staff (id, full_name, email, role, is_active)
  values (v_id, v_name, v_email, v_role::staff_role, true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        role = excluded.role,
        is_active = true;

  raise notice 'Local account ready: % (%) as %, staff.id = %', v_name, v_email, v_role, v_id;
end $$;
