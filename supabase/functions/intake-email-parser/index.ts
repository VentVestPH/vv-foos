// Agent 5 — Gmail auto-parser handoff endpoint (instruction 3). This is the
// AGREED CONTRACT between Agent 5 (parsing + intake_items) and Agent 6
// (Gmail label watch + delivery), per both briefs: "Agree the interface
// before either side builds." Agent 6 doesn't exist yet as a live
// integration, so this endpoint is independently testable now — POST a
// message payload by hand (or from a test script) and it behaves exactly as
// it will once Agent 6's watch calls it for real.
//
// Deploy: supabase functions deploy intake-email-parser --no-verify-jwt
// (no-verify-jwt because Agent 6's backend watch calls this server-to-server,
// not from a logged-in browser session — protected instead by a shared
// secret header, see INTAKE_EMAIL_PARSER_SECRET below.)
//
// Request: POST
// Headers: x-intake-secret: <shared secret, set as a function secret>
// Body: {
//   staffId: string,              // which connected mailbox this came from
//   label: string,                // the Gmail label that triggered delivery
//   message: {
//     id: string,                 // Gmail message id -> raw_payload, for traceability
//     from: string,               // "Name <email@domain.com>"
//     to: string[],
//     cc?: string[],
//     subject: string,
//     bodyText: string,
//     bodyHtml?: string,
//     date: string,                // ISO 8601
//     attachments?: { filename: string; mimeType: string; contentBase64: string }[]
//   }
// }
// Response: { intakeItemId: string, targetType: 'candidate'|'contact' }
//
// Contract notes for Agent 6:
// - Deliver the full message (headers, body, attachments) exactly once per
//   Gmail message id; this endpoint does not dedup by message id itself
//   (Agent 6's "mark message processed" bookkeeping is the source of truth
//   for exactly-once delivery, per that brief's instruction 9).
// - This endpoint owns parsing and intake_items creation. Agent 6 never
//   writes intake_items directly.
// - Resume-looking attachments (pdf/doc/docx) are staged to the attachments
//   Storage bucket now and referenced in parsed.attachments; the existing
//   import_intake_item() RPC (Agent 5's migration) moves them onto the
//   person's attachments row on import.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_SECRET = Deno.env.get("INTAKE_EMAIL_PARSER_SECRET");

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function client() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

interface Attachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

interface IncomingMessage {
  id: string;
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  date: string;
  attachments?: Attachment[];
}

interface ParserBody {
  staffId: string;
  label: string;
  message: IncomingMessage;
}

const RESUME_EXT = [".pdf", ".doc", ".docx"];
const CANDIDATE_HINTS = ["resume", "cv", "application", "apply", "applying", "candidate", "position"];
const CONTACT_HINTS = ["introduction", "intro call", "partnership", "proposal", "meeting request", "connect"];

function parseFromHeader(from: string): { name: string; email: string } {
  const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2].trim().toLowerCase() };
  }
  return { name: from.trim(), email: from.trim().toLowerCase() };
}

function inferTargetType(subject: string, body: string): "candidate" | "contact" {
  const text = `${subject} ${body}`.toLowerCase();
  if (CANDIDATE_HINTS.some((h) => text.includes(h))) return "candidate";
  if (CONTACT_HINTS.some((h) => text.includes(h))) return "contact";
  // "when unsure default candidate and let review correct it" — brief instruction 3
  return "candidate";
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (SHARED_SECRET) {
    const provided = req.headers.get("x-intake-secret");
    if (provided !== SHARED_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  let body: ParserBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.message?.id || !body.message.from) {
    return json({ error: "message.id and message.from are required" }, 400);
  }
  if (!body.staffId) {
    return json({ error: "staffId is required" }, 400);
  }

  const sb = client();
  const { name, email } = parseFromHeader(body.message.from);
  const targetType = inferTargetType(body.message.subject ?? "", body.message.bodyText ?? "");

  const stagedAttachments: { storage_path: string; filename: string; kind: string }[] = [];
  for (const att of body.message.attachments ?? []) {
    const ext = extOf(att.filename);
    if (!RESUME_EXT.includes(ext)) continue; // brief: only resume-looking attachments stage
    const bytes = base64ToBytes(att.contentBase64);
    const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `intake/${body.message.id}/${safeName}`;
    const blob = new Blob([bytes], { type: att.mimeType || "application/octet-stream" });
    const { error: uploadErr } = await sb.storage.from("attachments").upload(storagePath, blob, {
      contentType: att.mimeType || "application/octet-stream",
      upsert: true,
    });
    if (!uploadErr) {
      stagedAttachments.push({ storage_path: storagePath, filename: att.filename, kind: "resume" });
    }
  }

  const { data, error } = await sb
    .from("intake_items")
    .insert({
      channel: "email",
      target_type: targetType,
      full_name: name || email,
      raw_payload: {
        gmail_message_id: body.message.id,
        label: body.label,
        staff_id: body.staffId,
        from: body.message.from,
        to: body.message.to,
        cc: body.message.cc ?? [],
        subject: body.message.subject,
        date: body.message.date,
        attachment_filenames: (body.message.attachments ?? []).map((a) => a.filename),
      },
      parsed: {
        name: name || undefined,
        email,
        headline: body.message.subject || undefined,
        attachments: stagedAttachments.length > 0 ? stagedAttachments : undefined,
      },
      submitted_by: body.staffId,
      status: "parsed",
    })
    .select("id")
    .single();

  if (error) {
    return json({ error: error.message }, 400);
  }

  return json({ intakeItemId: data.id, targetType });
});
