-- Agent 6 — Google OAuth token storage in Supabase Vault. Per the brief's
-- data model note: "Storage outside the Gate 1 schema: OAuth tokens in
-- Supabase Vault ... If any of these need a table, propose it through a
-- decision-journal entry." Sync cursors, label config, templates, and the
-- unlink suppression list already have a home in `integration_settings`
-- (Gate 2 approved additions, migration 08) — this migration adds only the
-- Vault plumbing for tokens, which needs its own functions because the
-- `vault` schema isn't exposed to PostgREST directly.
--
-- One secret per staff user, holding the full token set as JSON
-- ({access_token, refresh_token, expires_at, scopes}). The secret's vault id
-- is tracked in integration_settings(key='google_tokens', staff_id=<staff>,
-- value={vault_id}) so lookups don't need a new table either.
--
-- Both functions are service-role only: revoked from `authenticated` so a
-- signed-in browser session can never read or write another user's tokens
-- (or even its own — Edge Functions are the only callers, using the service
-- role key, which never reaches the browser per the brief's business rules).

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    begin
      create extension if not exists supabase_vault;
    exception when others then
      raise notice 'supabase_vault not available on this host (local run?): Agent 6 token storage needs a Supabase-hosted project';
    end;
  end if;
end $$;

create or replace function public.set_google_tokens(p_staff_id uuid, p_tokens jsonb)
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  existing_vault_id uuid;
  secret_name text := 'google_tokens_' || p_staff_id::text;
begin
  select (value ->> 'vault_id')::uuid into existing_vault_id
    from integration_settings
   where key = 'google_tokens' and staff_id = p_staff_id;

  if existing_vault_id is not null then
    perform vault.update_secret(existing_vault_id, p_tokens::text);
  else
    existing_vault_id := vault.create_secret(p_tokens::text, secret_name, 'Google OAuth tokens for staff ' || p_staff_id::text);
    insert into integration_settings (staff_id, key, value)
    values (p_staff_id, 'google_tokens', jsonb_build_object('vault_id', existing_vault_id))
    on conflict (staff_id, key) where staff_id is not null
      do update set value = excluded.value, updated_at = now();
  end if;
end;
$$;

create or replace function public.get_google_tokens(p_staff_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, vault
as $$
declare
  v_vault_id uuid;
  v_secret text;
begin
  select (value ->> 'vault_id')::uuid into v_vault_id
    from integration_settings
   where key = 'google_tokens' and staff_id = p_staff_id;
  if v_vault_id is null then
    return null;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id = v_vault_id;
  if v_secret is null then
    return null;
  end if;
  return v_secret::jsonb;
end;
$$;

create or replace function public.clear_google_tokens(p_staff_id uuid)
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  v_vault_id uuid;
begin
  select (value ->> 'vault_id')::uuid into v_vault_id
    from integration_settings
   where key = 'google_tokens' and staff_id = p_staff_id;
  if v_vault_id is not null then
    delete from vault.secrets where id = v_vault_id;
    delete from integration_settings where key = 'google_tokens' and staff_id = p_staff_id;
  end if;
end;
$$;

revoke execute on function public.set_google_tokens(uuid, jsonb) from authenticated;
revoke execute on function public.get_google_tokens(uuid) from authenticated;
revoke execute on function public.clear_google_tokens(uuid) from authenticated;

comment on function public.set_google_tokens is
  'Agent 6: upsert a staff user''s Google OAuth token set into Supabase Vault. Service-role only.';
comment on function public.get_google_tokens is
  'Agent 6: read a staff user''s Google OAuth token set back out of Vault. Service-role only.';
comment on function public.clear_google_tokens is
  'Agent 6: remove a staff user''s stored Google OAuth tokens (disconnect). Service-role only.';

-- Client-safe status check for the settings page: scopes + timestamps only,
-- never access_token/refresh_token. Callable by the signed-in user for their
-- own row only (auth.uid() check inside, not just a grant), so this is safe
-- to expose to `authenticated` unlike the three functions above.
create or replace function public.get_my_google_status()
returns jsonb
language plpgsql security definer set search_path = public, vault
as $$
declare
  v_vault_id uuid;
  v_secret jsonb;
begin
  select (value ->> 'vault_id')::uuid into v_vault_id
    from integration_settings
   where key = 'google_tokens' and staff_id = auth.uid();
  if v_vault_id is null then
    return null;
  end if;
  select decrypted_secret::jsonb into v_secret from vault.decrypted_secrets where id = v_vault_id;
  if v_secret is null then
    return null;
  end if;
  return jsonb_build_object(
    'scopes', coalesce(v_secret -> 'scopes', '[]'::jsonb),
    'connected_at', v_secret ->> 'connected_at',
    'updated_at', v_secret ->> 'updated_at',
    'tier_last_connected', v_secret ->> 'tier_last_connected'
  );
end;
$$;

comment on function public.get_my_google_status is
  'Agent 6: scopes/timestamps only (no tokens) for the calling staff user''s own Google connection, for the settings page.';

-- Self-service disconnect: same authorization shape as get_my_google_status
-- (auth.uid() decides whose row this touches), so it's safe to grant to
-- `authenticated` even though clear_google_tokens itself is service-role only.
create or replace function public.disconnect_my_google()
returns void
language plpgsql security definer set search_path = public, vault
as $$
declare
  v_vault_id uuid;
begin
  select (value ->> 'vault_id')::uuid into v_vault_id
    from integration_settings
   where key = 'google_tokens' and staff_id = auth.uid();
  if v_vault_id is not null then
    delete from vault.secrets where id = v_vault_id;
    delete from integration_settings where key = 'google_tokens' and staff_id = auth.uid();
  end if;
end;
$$;

comment on function public.disconnect_my_google is
  'Agent 6: self-service Google disconnect — deletes the calling staff user''s own stored tokens.';
