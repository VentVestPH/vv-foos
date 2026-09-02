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

interface MeetingBody {
  personId: string;
  attendeeEmails: string[];
  subject: string;
  description?: string;
  startIso: string;
  durationMinutes: number;
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

  let body: MeetingBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body.subject || !body.startIso || !body.durationMinutes || !body.attendeeEmails?.length) {
    return json({ error: "subject, startIso, durationMinutes, and attendeeEmails are required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: tokens } = await admin.rpc("get_google_tokens", { p_staff_id: user.id });
  if (!tokens?.access_token) {
    return json({ error: "Google account not connected" }, 400);
  }
  if (!tokens.scopes?.includes("https://www.googleapis.com/auth/calendar.events")) {
    return json({ error: "Calendar scope not granted yet — connect it from Settings" }, 403);
  }

  const start = new Date(body.startIso);
  const end = new Date(start.getTime() + body.durationMinutes * 60_000);

  const eventRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: body.subject,
        description: body.description ?? "",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: body.attendeeEmails.map((email) => ({ email })),
        conferenceData: {
          createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    },
  );
  if (!eventRes.ok) {
    return json({ error: `Calendar create failed: ${eventRes.status}` }, 502);
  }
  const event = (await eventRes.json()) as {
    id: string;
    hangoutLink?: string;
    attendees?: { email: string }[];
  };

  const { data: activity, error: actErr } = await admin
    .from("activities")
    .insert({
      kind: "meeting",
      subject: body.subject,
      body: body.description ?? null,
      occurred_at: start.toISOString(),
      person_id: body.personId,
      deal_id: body.dealId ?? null,
      application_id: body.applicationId ?? null,
      company_id: body.companyId ?? null,
      requisition_id: body.requisitionId ?? null,
      gcal_event_id: event.id,
      attendees: event.attendees ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (actErr) return json({ error: actErr.message }, 500);

  return json({ activityId: activity.id, gcalEventId: event.id, meetLink: event.hangoutLink ?? null });
});
