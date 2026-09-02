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

  const appOrigin = req.headers.get("origin") ?? req.headers.get("referer")?.replace(/\/[^/]*$/, "") ?? null;

  const nonce = crypto.randomUUID();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
