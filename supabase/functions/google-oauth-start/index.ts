// Agent 6 — start the per-staff Google OAuth flow (instruction 1, incremental
// consent). Authenticated: the calling staff user's own JWT decides whose
// connection this is. Redirects the browser to Google's consent screen.
//
// NOT YET LIVE-TESTABLE: needs GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI set
// as function secrets first — see
// VVPH_VV-FOOS_Doc_Google-OAuth-Setup_2026-07-25_v1.0_Draft.md.
//
// Deploy: supabase functions deploy google-oauth-start
// Request: GET /google-oauth-start?tier=base|send|calendar
//   (or POST { tier } — the settings UI uses supabase.functions.invoke,
//   which POSTs a JSON body)
//   tier=base     -> gmail.readonly only (first connect)
//   tier=send     -> adds gmail.send
//   tier=calendar -> adds calendar.events
// Response: { url: string } — the client does `window.location.href = url`.
// (Not a raw 302: a plain <a href> navigation can't attach the Authorization
// bearer header this function needs, so the settings UI calls this via
// supabase.functions.invoke() — which the client library does with fetch,
// carrying the header — and then navigates the browser itself.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI");

const SCOPES: Record<string, string[]> = {
  base: ["https://www.googleapis.com/auth/gmail.readonly"],
  send: ["https://www.googleapis.com/auth/gmail.send"],
  calendar: ["https://www.googleapis.com/auth/calendar.events"],
};

// Called from the browser (supabase.functions.invoke), which means a CORS
// preflight — without these headers the browser blocks the request before
// it ever reaches this function ("Failed to fetch" client-side, no useful
// error). Found live: this was untested-from-a-real-browser code until now.
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (!CLIENT_ID || !REDIRECT_URI) {
    return json(
      {
        error:
          "Google OAuth isn't configured yet. See VVPH_VV-FOOS_Doc_Google-OAuth-Setup for the setup steps, then set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI as function secrets.",
      },
      503,
    );
  }

  const url = new URL(req.url);
  let tier = url.searchParams.get("tier") ?? "base";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.tier) tier = body.tier;
    } catch {
      // no body, or not JSON — fall back to query param / default
    }
  }
  const scopes = SCOPES[tier];
  if (!scopes) return json({ error: "Unknown scope tier" }, 400);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Not authenticated" }, 401);

  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return json({ error: "Not authenticated" }, 401);

  // Capture where the browser is calling from, so the callback (which runs
  // on the Supabase domain, not the app's) can redirect back to the right
  // place without depending on an APP_SETTINGS_URL secret — there's no way
  // to set function secrets from this environment yet, and a relative
  // "/settings" fallback resolves against the wrong (Supabase) origin, which
  // is exactly the bug this replaces (found live: redirect landed on
  // .../settings?google=connected but on the supabase.co domain, 404s).
  const appOrigin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/[^/]*$/, "") ?? null;

  // Single-use state: nonce -> staff_id (+ where to redirect back to), so
  // the callback can recover who this connection belongs to and where the
  // browser came from.
  const nonce = crypto.randomUUID();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // Plain insert, not upsert: the nonce is embedded in the key, so each call
  // produces a brand-new row and there's no conflict target to worry about
  // (integration_settings' unique index is partial, which plain upsert
  // syntax can't target anyway).
  await admin.from("integration_settings").insert({
    staff_id: user.id,
    key: `oauth_state_${nonce}`,
    value: { staff_id: user.id, tier, app_origin: appOrigin, created_at: new Date().toISOString() },
  });

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: scopes.join(" "),
    state: nonce,
  });

  return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});
