// Agent 6 — Gmail + Calendar sync (instructions 2, 3, 7). Combines both
// syncs in one function for this build pass (the brief describes them as
// parallel concerns with identical cadence/backoff/dedup shape; splitting
// them into two functions is a clean follow-up once this is running for
// real, not a structural requirement).
//
// NOT YET LIVE-TESTED against real Gmail/Calendar APIs — no OAuth client
// exists yet (see the setup doc). The Google API request shapes below follow
// the documented Gmail API v1 / Calendar API v3 surfaces; treat this as
// ready-to-test code once credentials exist, not as verified-working code.
//
// Deploy: supabase functions deploy google-sync --no-verify-jwt
// (intended trigger: a scheduled job — e.g. Supabase's cron-to-edge-function
// feature, or an external scheduler hitting this every 5 minutes per the
// brief's suggested cadence. --no-verify-jwt because a scheduler is the
// caller, not a browser session; protect with a shared secret the same way
// intake-email-parser does, via GOOGLE_SYNC_SECRET, before exposing this
// publicly.)
//
// Request: POST (no body required; syncs every staff user with stored
// tokens). Optional { staffId } to sync just one account.
// Response: { synced: number, errors: { staffId: string; message: string }[] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET");
const SYNC_SECRET = Deno.env.get("GOOGLE_SYNC_SECRET");

// Not called from the app UI in production (a scheduler hits this), but
// CORS headers make it directly testable from a browser console too, and
// cost nothing since this endpoint has no session/cookie to leak.
const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, x-sync-secret",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function client() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

interface GoogleTokens {
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string[];
}

async function refreshIfNeeded(sb: ReturnType<typeof client>, staffId: string, tokens: GoogleTokens) {
  if (new Date(tokens.expires_at).getTime() > Date.now() + 60_000) return tokens;
  if (!tokens.refresh_token || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("token expired and no refresh_token available — reconnect required");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  const updated: GoogleTokens = {
    ...tokens,
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
  await sb.rpc("set_google_tokens", { p_staff_id: staffId, p_tokens: updated });
  return updated;
}

function normalizeEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return (match ? match[1] : addr).trim().toLowerCase();
}

async function matchPeopleByEmails(sb: ReturnType<typeof client>, emails: string[]) {
  if (emails.length === 0) return [] as { id: string }[];
  // people.emails is a jsonb array of {type,address}; match any address.
  const { data } = await sb
    .from("people")
    .select("id, emails")
    .limit(2000); // modest volumes per architecture doc's migration notes
  const normalized = emails.map(normalizeEmail);
  return (data ?? []).filter((p) => {
    const addrs = ((p.emails as { address?: string }[] | null) ?? []).map((e) =>
      (e.address ?? "").toLowerCase(),
    );
    return addrs.some((a) => normalized.includes(a));
  });
}

async function syncGmail(sb: ReturnType<typeof client>, staffId: string, tokens: GoogleTokens) {
  if (!tokens.scopes.includes("https://www.googleapis.com/auth/gmail.readonly")) return 0;

  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20",
    { headers: { authorization: `Bearer ${tokens.access_token}` } },
  );
  if (!listRes.ok) throw new Error(`gmail list failed: ${listRes.status}`);
  const { messages } = (await listRes.json()) as { messages?: { id: string }[] };

  let count = 0;
  for (const m of messages ?? []) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { authorization: `Bearer ${tokens.access_token}` } },
    );
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();
    const headers: Record<string, string> = {};
    for (const h of msg.payload?.headers ?? []) headers[h.name] = h.value;

    const participants = [headers.From, headers.To, headers.Cc].filter(Boolean).join(",").split(",");
    const matched = await matchPeopleByEmails(sb, participants);

    for (const person of matched) {
      // Dedup by gmail_message_id + person_id (instruction 3).
      const { data: existing } = await sb
        .from("activities")
        .select("id")
        .eq("gmail_message_id", m.id)
        .eq("person_id", person.id)
        .maybeSingle();
      if (existing) continue;

      await sb.from("activities").insert({
        kind: "email",
        subject: headers.Subject ?? null,
        occurred_at: headers.Date ? new Date(headers.Date).toISOString() : new Date().toISOString(),
        person_id: person.id,
        gmail_message_id: m.id,
        created_by: staffId,
      });
      count++;
    }
  }
  return count;
}

async function syncCalendar(sb: ReturnType<typeof client>, staffId: string, tokens: GoogleTokens) {
  if (!tokens.scopes.includes("https://www.googleapis.com/auth/calendar.events")) return 0;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${new Date().toISOString()}&maxResults=20&singleEvents=true`,
    { headers: { authorization: `Bearer ${tokens.access_token}` } },
  );
  if (!res.ok) throw new Error(`calendar list failed: ${res.status}`);
  const { items } = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      status: string;
      attendees?: { email: string }[];
    }[];
  };

  let count = 0;
  for (const ev of items ?? []) {
    const attendeeEmails = (ev.attendees ?? []).map((a) => a.email);
    const matched = await matchPeopleByEmails(sb, attendeeEmails);
    const occurredAt = ev.start?.dateTime ?? ev.start?.date ?? new Date().toISOString();

    for (const person of matched) {
      const { data: existing } = await sb
        .from("activities")
        .select("id")
        .eq("gcal_event_id", ev.id)
        .eq("person_id", person.id)
        .maybeSingle();

      if (existing) {
        // Update in place rather than duplicate (instruction 7: time change
        // or cancellation updates the existing activity).
        await sb
          .from("activities")
          .update({
            subject: ev.status === "cancelled" ? `${ev.summary ?? "Meeting"} (cancelled)` : ev.summary,
            occurred_at: new Date(occurredAt).toISOString(),
            attendees: ev.attendees ?? [],
          })
          .eq("id", existing.id);
        continue;
      }

      await sb.from("activities").insert({
        kind: "meeting",
        subject: ev.summary ?? null,
        occurred_at: new Date(occurredAt).toISOString(),
        person_id: person.id,
        gcal_event_id: ev.id,
        attendees: ev.attendees ?? [],
        created_by: staffId,
      });
      count++;
    }
  }
  return count;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const sb = client();

  // Auth: GOOGLE_SYNC_SECRET env var if set (no tool exists in this
  // environment to set Edge Function secrets remotely, so this is a
  // fallback for whenever someone sets it directly in the dashboard/CLI);
  // otherwise fall back to a secret stored in integration_settings
  // (staff_id null, key='google_sync_secret'), set once via SQL. Either
  // path requires the caller to present it as x-sync-secret.
  let syncSecret: string | null | undefined = SYNC_SECRET;
  if (!syncSecret) {
    const { data: secretRow } = await sb
      .from("integration_settings")
      .select("value")
      .eq("key", "google_sync_secret")
      .is("staff_id", null)
      .maybeSingle();
    syncSecret = (secretRow?.value as { secret?: string } | null)?.secret ?? null;
  }
  if (!syncSecret) {
    console.error("google-sync: no sync secret configured; refusing all requests");
    return json(
      {
        error:
          "Endpoint is not configured. Set GOOGLE_SYNC_SECRET, or an integration_settings row " +
          "(staff_id null, key 'google_sync_secret'), before use.",
      },
      503,
    );
  }
  if (req.headers.get("x-sync-secret") !== syncSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  let body: { staffId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body is fine — sync everyone
  }

  const { data: tokenRows } = await sb
    .from("integration_settings")
    .select("staff_id")
    .eq("key", "google_tokens")
    .not("staff_id", "is", null);

  const staffIds = body.staffId
    ? [body.staffId]
    : Array.from(new Set((tokenRows ?? []).map((r) => r.staff_id as string)));

  let synced = 0;
  const errors: { staffId: string; message: string }[] = [];

  for (const staffId of staffIds) {
    try {
      const { data: tokens } = await sb.rpc("get_google_tokens", { p_staff_id: staffId });
      if (!tokens) continue;
      const fresh = await refreshIfNeeded(sb, staffId, tokens as GoogleTokens);
      const gmailCount = await syncGmail(sb, staffId, fresh);
      const calendarCount = await syncCalendar(sb, staffId, fresh);
      synced += gmailCount + calendarCount;
    } catch (err) {
      errors.push({ staffId, message: (err as Error).message });
    }
  }

  return json({ synced, errors });
});
