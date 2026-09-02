import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function base64UrlEncode(input: string): string {
  return btoa(unescape(encodeURIComponent(input)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

interface SendBody {
  personId: string;
  to: string;
  subject: string;
  bodyText: string;
  threadId?: string;
  dealId?: string;
  applicationId?: string;
  companyId?: string;
  requisitionId?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

  let body: SendBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.to || !body.subject || !body.bodyText) {
    return json({ error: "to, subject, and bodyText are required" }, 400);
  }
  if (/\{[^}]+\}/.test(body.bodyText) || /\{[^}]+\}/.test(body.subject)) {
    return json({ error: "Message still contains unresolved {placeholders} — resolve before sending" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: tokens } = await admin.rpc("get_google_tokens", { p_staff_id: user.id });
  if (!tokens?.access_token) {
    return json({ error: "Google account not connected, or send scope not granted" }, 400);
  }
  if (!tokens.scopes?.includes("https://www.googleapis.com/auth/gmail.send")) {
    return json({ error: "Gmail send scope not granted yet — connect it from Settings" }, 403);
  }

  const mime = [
    `To: ${body.to}`,
    `Subject: ${body.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body.bodyText,
  ].join("\r\n");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      raw: base64UrlEncode(mime),
      threadId: body.threadId,
    }),
  });
  if (!sendRes.ok) {
    return json({ error: `Gmail send failed: ${sendRes.status}` }, 502);
  }
  const sent = (await sendRes.json()) as { id: string; threadId: string };

  const { data: activity, error: actErr } = await admin
    .from("activities")
    .insert({
      kind: "email",
      subject: body.subject,
      body: body.bodyText,
      occurred_at: new Date().toISOString(),
      person_id: body.personId,
      deal_id: body.dealId ?? null,
      application_id: body.applicationId ?? null,
      company_id: body.companyId ?? null,
      requisition_id: body.requisitionId ?? null,
      gmail_message_id: sent.id,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (actErr) return json({ error: actErr.message }, 500);

  return json({ activityId: activity.id, gmailMessageId: sent.id, threadId: sent.threadId });
});
