// Agent 4 — public apply endpoint. Unauthenticated, rate-limited. All writes
// happen server-side with the service role; the browser never touches
// tables or Storage directly. Deploy with --no-verify-jwt (public).
//
// Deploy: supabase functions deploy careers-apply --no-verify-jwt
//
// On a valid submission: creates one intake_items row (channel=careers_form),
// dedups against people (email, then linkedin_public_url), creates or
// attaches to a people row, upserts one applications row (unique on
// requisition_id + person_id — a repeat application updates, not
// duplicates), uploads the resume to the attachments Storage bucket, and
// marks the intake item imported. Fires (via schema triggers, not this
// function): intake_item.received, intake_item.imported, application.created.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMIT_PER_HOUR = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = [".pdf", ".doc", ".docx"];

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function client() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

// Verifies the file signature (magic bytes) matches a claimed office-doc
// type, independent of filename/extension, so a renamed .exe is rejected.
function signatureMatches(bytes: Uint8Array, ext: string): boolean {
  const head = Array.from(bytes.slice(0, 4));
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04; // docx (zip)
  const isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0; // doc (OLE)
  if (ext === ".pdf") return isPdf;
  if (ext === ".docx") return isZip;
  if (ext === ".doc") return isOle || isZip; // some .doc files are actually OLE2; a few tools save zip-based
  return false;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  const sb = client();
  const ip = clientIp(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, message: "Could not read submission." }, 400);
  }

  const get = (key: string) => (form.get(key)?.toString() ?? "").trim();

  // ---- Honeypot: silent drop. Respond as if successful so bots learn nothing.
  const honeypot = get("company_website");
  if (honeypot) {
    console.warn("careers-apply: honeypot triggered", { ip, at: new Date().toISOString() });
    return json({ ok: true, message: "Application received." });
  }

  // ---- Rate limit: 5 submissions / IP / hour (configurable via env override).
  const limit = Number(Deno.env.get("CAREERS_RATE_LIMIT_PER_HOUR") ?? RATE_LIMIT_PER_HOUR);
  const { data: attemptCount, error: rateErr } = await sb.rpc("careers_record_attempt", { p_ip: ip });
  if (rateErr) {
    console.error("careers-apply: rate limit check failed", rateErr);
  } else if (typeof attemptCount === "number" && attemptCount > limit) {
    return json(
      { ok: false, message: "You've submitted several applications recently. Please try again in a bit." },
      429,
    );
  }

  const requisitionId = get("requisition_id");
  const fullName = get("full_name");
  const email = get("email");
  const phone = get("phone");
  const linkedinUrl = get("linkedin_url");
  const consent = get("consent");
  const resume = form.get("resume");

  // ---- Field validation
  if (!requisitionId) return json({ ok: false, message: "Missing role reference." }, 400);
  if (!fullName) return json({ ok: false, message: "Full name is required." }, 400);
  if (!email || !isValidEmail(email)) return json({ ok: false, message: "A valid email is required." }, 400);
  if (!phone) return json({ ok: false, message: "Phone is required." }, 400);
  if (consent !== "on" && consent !== "true") {
    return json({ ok: false, message: "Please accept the privacy notice to continue." }, 400);
  }
  if (!(resume instanceof File) || resume.size === 0) {
    return json({ ok: false, message: "A resume file is required." }, 400);
  }
  const ext = extOf(resume.name);
  if (!ALLOWED_EXT.includes(ext)) {
    return json({ ok: false, message: "Resume must be a PDF, DOC, or DOCX file." }, 400);
  }
  if (resume.size > MAX_FILE_BYTES) {
    return json({ ok: false, message: "Resume exceeds the 10 MB limit." }, 400);
  }
  const resumeBytes = new Uint8Array(await resume.arrayBuffer());
  if (!signatureMatches(resumeBytes, ext)) {
    return json({ ok: false, message: "That file doesn't look like a valid PDF/DOC/DOCX. Please re-export and try again." }, 400);
  }

  // ---- Requisition eligibility
  const { data: req_, error: reqErr } = await sb
    .from("requisitions")
    .select("id, is_published, is_test, status")
    .eq("id", requisitionId)
    .maybeSingle();
  if (reqErr) {
    console.error("careers-apply: requisition lookup failed", reqErr);
    return json({ ok: false, message: "Something went wrong. Please try again." }, 500);
  }
  if (!req_ || !req_.is_published || req_.is_test || req_.status !== "open") {
    return json({ ok: false, message: "This role is no longer accepting applications." }, 400);
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ---- Create the intake_items row first (fires intake_item.received).
  const { data: intakeItem, error: intakeErr } = await sb
    .from("intake_items")
    .insert({
      channel: "careers_form",
      target_type: "candidate",
      raw_payload: {
        full_name: fullName,
        email: normalizedEmail,
        phone,
        linkedin_url: linkedinUrl || null,
        resume_filename: resume.name,
        submitted_at: new Date().toISOString(),
        ip,
      },
      parsed: {
        name: fullName,
        emails: [normalizedEmail],
        phones: [phone],
        urls: linkedinUrl ? [linkedinUrl] : [],
      },
      full_name: fullName,
      linkedin_url: linkedinUrl || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (intakeErr) {
    console.error("careers-apply: intake insert failed", intakeErr);
    return json({ ok: false, message: "Something went wrong. Please try again." }, 500);
  }

  try {
    // ---- Dedup: normalized email first, linkedin_public_url second.
    let personId: string | null = null;
    let duplicateOf: string | null = null;

    const { data: byEmail } = await sb.rpc("find_person_by_email", { p_email: normalizedEmail });
    if (byEmail) {
      personId = byEmail as string;
      duplicateOf = byEmail as string;
    } else if (linkedinUrl) {
      const { data: byLinkedin } = await sb.rpc("find_person_by_linkedin", { p_url: linkedinUrl });
      if (byLinkedin) {
        personId = byLinkedin as string;
        duplicateOf = byLinkedin as string;
      }
    }

    if (!personId) {
      const { first, last } = splitName(fullName);
      const { data: newPerson, error: personErr } = await sb
        .from("people")
        .insert({
          first_name: first || fullName,
          last_name: last || null,
          emails: [{ type: "personal", address: normalizedEmail }],
          phones: [{ type: "personal", number: phone }],
          linkedin_public_url: linkedinUrl || null,
          is_test: false,
        })
        .select("id")
        .single();
      if (personErr || !newPerson) throw personErr ?? new Error("person insert failed");
      personId = newPerson.id as string;
    }

    // ---- Upload resume before the application row references it.
    const safeName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `person/${personId}/${Date.now()}_${safeName}`;
    const resumeBlob = new Blob([resumeBytes], { type: resume.type || "application/octet-stream" });
    const { error: uploadErr } = await sb.storage
      .from("attachments")
      .upload(storagePath, resumeBlob, {
        contentType: resume.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    const { error: attachmentErr } = await sb.from("attachments").insert({
      storage_path: storagePath,
      parent_type: "person",
      parent_id: personId,
      kind: "resume",
      description: "Submitted via careers page",
    });
    if (attachmentErr) throw attachmentErr;

    // ---- Sources lookup (seeded: 'Careers page').
    const { data: source } = await sb.from("sources").select("id").eq("name", "Careers page").maybeSingle();

    // ---- Application: unique(requisition_id, person_id) — a repeat
    // application to the same role updates rather than duplicating.
    const { data: existingApp } = await sb
      .from("applications")
      .select("id")
      .eq("requisition_id", requisitionId)
      .eq("person_id", personId)
      .maybeSingle();

    if (existingApp) {
      const { error: updateErr } = await sb
        .from("applications")
        .update({
          answers: { consent_at: new Date().toISOString(), reapplied: true },
          applied_at: new Date().toISOString(),
        })
        .eq("id", existingApp.id);
      if (updateErr) throw updateErr;
    } else {
      const { error: appErr } = await sb.from("applications").insert({
        requisition_id: requisitionId,
        person_id: personId,
        stage: "received",
        source_id: source?.id ?? null,
        answers: { consent_at: new Date().toISOString() },
        applied_at: new Date().toISOString(),
      });
      if (appErr) throw appErr;
    }

    // ---- Mark the intake item imported (fires intake_item.imported).
    const { error: importedErr } = await sb
      .from("intake_items")
      .update({ person_id: personId, duplicate_of: duplicateOf, status: "imported" })
      .eq("id", intakeItem.id);
    if (importedErr) throw importedErr;

    return json({ ok: true, message: "Application received." });
  } catch (err) {
    console.error("careers-apply: import failed", err);
    // Leave the intake_items row as 'pending' with raw_payload intact so it
    // can be reprocessed manually — never leave the applicant with a false
    // success and never lose the submission.
    await sb.from("intake_items").update({ status: "pending" }).eq("id", intakeItem.id);
    return json(
      { ok: false, message: "We received your submission but hit an error finishing setup. A recruiter will follow up." },
      500,
    );
  }
});
