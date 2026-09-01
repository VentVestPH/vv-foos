// Agent 6 — OAuth callback (instruction 1). Google redirects the browser
// here directly (no JWT available), so the single-use `state` nonce from
// google-oauth-start is what recovers which staff user this belongs to.
// Exchanges the code for tokens, merges scopes with anything already
// granted, and stores the result in Supabase Vault via set_google_tokens().
//
// NOT YET LIVE-TESTABLE: needs the Google OAuth client secrets configured
// first — see VVPH_VV-FOOS_Doc_Google-OAuth-Setup_2026-07-25_v1.0_Draft.md.
//
// Deploy: supabase functions deploy google-oauth-callback --no-verify-jwt
// (no-verify-jwt: Google's redirect carries no Supabase session)
//
// Request: GET /google-oauth-callback?code=...&state=...
// Response: 302 redirect back to the app's /settings page with
//   ?google=connected or ?google=error

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");
// Fallback only — used if a state row somehow has no app_origin recorded
// (shouldn't happen for state rows created by the current google-oauth-start,
// which always captures the browser's Origin/Referer). Override via secret
// if the app ever has one fixed deployed URL.
const FALLBACK_SETTINGS_URL = Deno.env.get("APP_SETTINGS_URL") ?? "/settings";

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  // Best-effort: recover app_origin from the state row even on an error path,
  // so error redirects land on the right app too, not just success ones.
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

  // Recover + consume the single-use state row.
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

  // Exchange the code for tokens.
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

  // Merge with any existing tokens — Google only returns a refresh_token on
  // the first consent for a given client/user pair; keep the old one on
  // subsequent incremental-consent round trips.
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
