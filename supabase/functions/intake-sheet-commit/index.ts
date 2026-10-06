import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOW_ORIGIN = Deno.env.get("APP_PRIMARY_ORIGIN") ?? "*";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": ALLOW_ORIGIN,
  vary: "Origin",
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
  requisitionId?: string;
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

  if (
    !Array.isArray(body.rows) ||
    body.rows.length === 0 ||
    body.rows.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    return json({ error: "rows is required and must be non-empty" }, 400);
  }
  if (!body.targetType || !["candidate", "contact"].includes(body.targetType)) {
    return json({ error: "targetType must be candidate or contact" }, 400);
  }
  if (!body.batchLabel?.trim()) {
    return json({ error: "batchLabel is required" }, 400);
  }

  const map = body.columnMap ?? {};
  const get = (row: Record<string, string>, field: string) => {
    const value = map[field] ? row[map[field]] : "";
    return value === null || value === undefined ? "" : String(value).trim();
  };

  if (body.targetType === "candidate") {
    for (const [index, row] of body.rows.entries()) {
      const fullName = get(row, "name");
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const firstName = get(row, "first_name") || nameParts[0] || "";
      const lastName = get(row, "last_name") || nameParts.slice(1).join(" ");
      if (!firstName || !lastName) {
        return json({ error: `Row ${index + 2}: first and last name are required.` }, 400);
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get(row, "email"))) {
        return json({ error: `Row ${index + 2}: enter a valid email address.` }, 400);
      }
      const phone = get(row, "phone");
      if (phone && !/^\+?[0-9][0-9\s(),-]*$/.test(phone)) {
        return json({ error: `Row ${index + 2}: phone contains unsupported characters.` }, 400);
      }
      for (const field of ["expected_salary", "current_salary"]) {
        const amount = get(row, field);
        if (amount && !/^[0-9]+(\.[0-9]+)?$/.test(amount)) {
          return json({ error: `Row ${index + 2}: ${field.replace("_", " ")} must be numeric.` }, 400);
        }
      }
    }
  }

  const requisitionByCode = new Map<string, string>();
  const requisitionIds = new Set<string>();
  if (body.targetType === "candidate") {
    const hasRowCodes = body.rows.some((row) => get(row, "requisition"));
    if (body.requisitionId || hasRowCodes) {
      const { data: available, error: requisitionError } = await sb
        .from("requisition_list")
        .select("id, display_code")
        .in("status", ["open", "waiting_approval", "on_hold"]);
      if (requisitionError) return json({ error: requisitionError.message }, 400);
      for (const requisition of available ?? []) {
        requisitionByCode.set(requisition.display_code.toLowerCase(), requisition.id);
        requisitionIds.add(requisition.id);
      }
      if (body.requisitionId && !requisitionIds.has(body.requisitionId)) {
        return json({ error: "The selected requisition is no longer available." }, 400);
      }
      for (const [index, row] of body.rows.entries()) {
        const code = get(row, "requisition");
        if (code && !requisitionByCode.has(code.toLowerCase())) {
          return json({ error: `Row ${index + 2}: requisition ${code} is not available.` }, 400);
        }
      }
    }
  }

  const insertRows = body.rows.map((row) => {
    const firstName = get(row, "first_name");
    const lastName = get(row, "last_name");
    const name = get(row, "name") || [firstName, lastName].filter(Boolean).join(" ");
    const email = get(row, "email");
    const phone = get(row, "phone");
    const company = get(row, "current_employer") || get(row, "company");
    const title = get(row, "current_title") || get(row, "title");
    const headline = get(row, "headline");
    const linkedinUrl = get(row, "linkedin_url");
    const education = {
      university: get(row, "university"),
      bachelor_discipline: get(row, "bachelor_discipline"),
      year: get(row, "education_year"),
      higher_degrees: get(row, "higher_degrees"),
      other_degrees: get(row, "other_degrees"),
    };
    const experience = {
      title: get(row, "experience_title"),
      employer: get(row, "experience_employer"),
      start_date: get(row, "experience_start_date"),
      end_date: get(row, "experience_end_date"),
      description: get(row, "experience_description"),
    };
    const present = (value: Record<string, string>) =>
      Object.fromEntries(Object.entries(value).filter(([, field]) => field));
    const educationFields = present(education);
    const experienceFields = present(experience);
    const requisitionCode = get(row, "requisition").toLowerCase();
    const rowRequisitionId = requisitionCode
      ? requisitionByCode.get(requisitionCode)
      : body.requisitionId;

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
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        title: title || undefined,
        current_title: title || undefined,
        current_employer: company || undefined,
        country: get(row, "country") || undefined,
        status: get(row, "candidate_status") || undefined,
        requisition_id: body.targetType === "candidate" ? rowRequisitionId || undefined : undefined,
        tenure_note: get(row, "tenure_note") || undefined,
        expected_salary: get(row, "expected_salary") || undefined,
        current_salary: get(row, "current_salary") || undefined,
        salary_currency: get(row, "salary_currency") || undefined,
        salary_flag: get(row, "salary_flag") || undefined,
        education: Object.keys(educationFields).length ? [educationFields] : undefined,
        experience: Object.keys(experienceFields).length ? [experienceFields] : undefined,
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
