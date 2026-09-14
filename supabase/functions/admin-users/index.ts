import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOW_ORIGIN = Deno.env.get("APP_PRIMARY_ORIGIN") ?? "*";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": ALLOW_ORIGIN,
  vary: "Origin",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};

const TEMP_PASSWORD_BYTES = 15;
const USER_PAGE_SIZE = 200;
const USER_PAGE_CAP = 50;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

function tempPassword(): string {
  const bytes = new Uint8Array(TEMP_PASSWORD_BYTES);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, "");
}

interface AdminBody {
  action: "list" | "temp_password" | "send_reset";
  staffId?: string;
  redirectTo?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await caller.auth.getUser();
  if (userErr || !user) return json({ error: "Not authenticated" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: me, error: meErr } = await admin
    .from("staff")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (meErr) return json({ error: meErr.message }, 500);
  if (!me || me.role !== "admin" || !me.is_active) {
    return json({ error: "Administrator access is required" }, 403);
  }

  let body: AdminBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (body.action === "list") {
    const { data: staff, error: staffErr } = await admin
      .from("staff")
      .select("id, full_name, email, role, title, is_active")
      .order("is_active", { ascending: false })
      .order("email");
    if (staffErr) return json({ error: staffErr.message }, 500);

    const byId = new Map<string, { lastSignInAt: string | null; providers: string[]; confirmed: boolean }>();
    for (let page = 1; page <= USER_PAGE_CAP; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE });
      if (error) return json({ error: error.message }, 500);
      const users = data?.users ?? [];
      for (const u of users) {
        byId.set(u.id, {
          lastSignInAt: u.last_sign_in_at ?? null,
          providers: (u.identities ?? []).map((i) => i.provider),
          confirmed: Boolean(u.email_confirmed_at),
        });
      }
      if (users.length < USER_PAGE_SIZE) break;
    }

    return json({
      users: (staff ?? []).map((s) => {
        const auth = byId.get(s.id);
        return {
          staffId: s.id,
          fullName: s.full_name,
          email: s.email,
          role: s.role,
          title: s.title,
          isActive: s.is_active,
          canSignIn: Boolean(auth),
          lastSignInAt: auth?.lastSignInAt ?? null,
          providers: auth?.providers ?? [],
          emailConfirmed: auth?.confirmed ?? false,
        };
      }),
    });
  }

  if (!body.staffId) return json({ error: "staffId is required" }, 400);

  const { data: target, error: targetErr } = await admin
    .from("staff")
    .select("id, email, full_name, role")
    .eq("id", body.staffId)
    .maybeSingle();
  if (targetErr) return json({ error: targetErr.message }, 500);
  if (!target) return json({ error: "No staff row with that id" }, 404);
  if (!target.email) return json({ error: "That staff row has no email address" }, 400);

  if (body.action === "temp_password") {
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(target.id, { password });
    if (error) {
      if (/user not found/i.test(error.message)) {
        const created = await admin.auth.admin.createUser({
          id: target.id,
          email: target.email,
          password,
          email_confirm: true,
        });
        if (created.error) return json({ error: created.error.message }, 500);
        return json({ password, email: target.email, created: true });
      }
      return json({ error: error.message }, 500);
    }
    return json({ password, email: target.email, created: false });
  }

  if (body.action === "send_reset") {
    const { error } = await admin.auth.resetPasswordForEmail(
      target.email,
      body.redirectTo ? { redirectTo: body.redirectTo } : undefined,
    );
    if (error) return json({ error: error.message }, 500);
    return json({ sent: true, email: target.email });
  }

  return json({ error: "Unknown action" }, 400);
});
