// Agent 5 — sheet/Excel import commit (instruction 5, second half). Takes
// the rows the client already fetched via intake-sheet-fetch plus a column
// mapping, and writes one intake_items row per record. Runs as the calling
// staff user (their own JWT forwarded, not the service role) so the existing
// intake_items RLS policies decide what they're allowed to stage — a
// recruiter can't sneak in contact-target rows through this endpoint any
// more than through the UI.
//
// Deploy: supabase functions deploy intake-sheet-commit
// Request: POST {
//   rows: Record<string,string>[],       // from intake-sheet-fetch, or a subset
//   columnMap: Record<string,string>,    // parsed-field -> source column name
//                                        // keys: name, headline, email, phone,
//                                        // company, title, linkedin_url
//   targetType: 'candidate' | 'contact',
//   batchLabel: string,
//   saveTemplate?: { name: string; sourceHint?: string },
// }
// Response: { created: number, templateId?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Called from the browser — needs a CORS preflight response or the request
// never leaves the browser ("Failed to fetch", found live during testing).
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

interface CommitBody {
  rows: Record<string, string>[];
  columnMap: Record<string, string>;
  targetType: "candidate" | "contact";
  batchLabel: string;
  saveTemplate?: { name: string; sourceHint?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  let body: CommitBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return json({ error: "rows is required and must be non-empty" }, 400);
  }
  if (!body.targetType || !["candidate", "contact"].includes(body.targetType)) {
    return json({ error: "targetType must be candidate or contact" }, 400);
  }
  if (!body.batchLabel?.trim()) {
    return json({ error: "batchLabel is required" }, 400);
  }

  const map = body.columnMap ?? {};
  const get = (row: Record<string, string>, field: string) =>
    map[field] ? (row[map[field]] ?? "").trim() : "";

  const insertRows = body.rows.map((row) => {
    const name = get(row, "name");
    const email = get(row, "email");
    const phone = get(row, "phone");
    const company = get(row, "company");
    const title = get(row, "title");
    const headline = get(row, "headline");
    const linkedinUrl = get(row, "linkedin_url");

    return {
      channel: "sheet_import" as const,
      target_type: body.targetType,
      full_name: name || null,
      linkedin_url: linkedinUrl || null,
      batch_label: body.batchLabel.trim(),
      submitted_by: user.id,
      raw_payload: row,
      parsed: {
        name,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        title: title || undefined,
        headline: headline || undefined,
        linkedin_url: linkedinUrl || undefined,
      },
      status: "parsed" as const,
    };
  });

  const { data, error: insertErr } = await sb
    .from("intake_items")
    .insert(insertRows)
    .select("id");

  if (insertErr) {
    return json({ error: insertErr.message }, 400);
  }

  let templateId: string | undefined;
  if (body.saveTemplate?.name?.trim()) {
    const { data: tpl, error: tplErr } = await sb
      .from("intake_mapping_templates")
      .insert({
        name: body.saveTemplate.name.trim(),
        source_hint: body.saveTemplate.sourceHint ?? null,
        column_map: map,
        target_type: body.targetType,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (!tplErr && tpl) templateId = tpl.id;
  }

  return json({ created: data?.length ?? 0, templateId });
});
