import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");

const FALLBACK_SETTINGS_URL = Deno.env.get("APP_SETTINGS_URL") ?? "/settings";

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  async function settingsUrl(): Promise<string> {
    if (!state) return FALLBACK_SETTINGS_URL;
    const { data } = await admin
      .from("integration_settings")
      .select("value")
      .eq("key", `oauth_state_${state}`)
      .maybeSingle();
    const origin = (data?.value as { app_origin?: string } | null)?.app_origin;
    return origin ? `${origin}/settings` : FALLBACK_SETTINGS_URL;
  }

  if (oauthError) {
    return redirect(`${await settingsUrl()}?google=error&reason=${encodeURIComponent(oauthError)}`);
  }
  if (!code || !state) {
    return redirect(`${await settingsUrl()}?google=error&reason=missing_code_or_state`);
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    return redirect(`${await settingsUrl()}?google=error&reason=oauth_not_configured`);
  }

  const APP_SETTINGS_URL = await settingsUrl();

  const { data: stateRow } = await admin
    .from("integration_settings")
    .select("id, staff_id, value")
    .eq("key", `oauth_state_${state}`)
    .maybeSingle();
  if (!stateRow) {
    return redirect(`${APP_SETTINGS_URL}?google=error&reason=invalid_or_expired_state`);
  }
  await admin.from("integration_settings").delete().eq("id", stateRow.id);
  const staffId = stateRow.staff_id as string;
  const tier = (stateRow.value as { tier?: string })?.tier ?? "base";

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    return redirect(`${APP_SETTINGS_URL}?google=error&reason=token_exchange_failed`);
  }
  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  const { data: existing } = await admin.rpc("get_google_tokens", { p_staff_id: staffId });
  const merged = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? existing?.refresh_token ?? null,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
    scopes: Array.from(
      new Set([...(existing?.scopes ?? []), ...tokenData.scope.split(" ")]),
    ),
    tier_last_connected: tier,
    connected_at: existing?.connected_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await admin.rpc("set_google_tokens", { p_staff_id: staffId, p_tokens: merged });

  return redirect(`${APP_SETTINGS_URL}?google=connected`);
});
