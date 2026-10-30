import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { guardAdminChange, parseNewStaff, parseStaffChange } from "../_shared/staff-admin.ts";

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

type AdminBody = Record<string, unknown> & {
  action: "list" | "temp_password" | "send_reset" | "update" | "create";
  staffId?: string;
  redirectTo?: string;
};

async function findAuthUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
): Promise<{ id: string | null; error: string | null }> {
  for (let page = 1; page <= USER_PAGE_CAP; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE });
    if (error) return { id: null, error: error.message };
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return { id: hit.id, error: null };
    if (users.length < USER_PAGE_SIZE) break;
  }
  return { id: null, error: null };
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

  if (body.action === "create") {
    const parsed = parseNewStaff(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const input = parsed.value;

    const { data: clash, error: clashErr } = await admin
      .from("staff")
      .select("id")
      .eq("email", input.email)
      .maybeSingle();
    if (clashErr) return json({ error: clashErr.message }, 500);
    if (clash) return json({ error: "A staff record with that email already exists" }, 409);

    const existing = await findAuthUserByEmail(admin, input.email);
    if (existing.error) return json({ error: existing.error }, 500);

    let authId: string;
    let loginCreated = false;
    if (existing.id) {
      const { data: owner, error: ownerErr } = await admin
        .from("staff")
        .select("id")
        .eq("id", existing.id)
        .maybeSingle();
      if (ownerErr) return json({ error: ownerErr.message }, 500);
      if (owner) return json({ error: "That login already belongs to another staff record" }, 409);
      authId = existing.id;
    } else {
      authId = crypto.randomUUID();
      const created = await admin.auth.admin.createUser({
        id: authId,
        email: input.email,
        email_confirm: true,
      });
      if (created.error) return json({ error: created.error.message }, 500);
      loginCreated = true;
    }

    const { error: insertErr } = await admin.from("staff").insert({
      id: authId,
      full_name: input.fullName,
      email: input.email,
      role: input.role,
      title: input.title,
      is_active: true,
    });
    if (insertErr) {
      if (loginCreated) await admin.auth.admin.deleteUser(authId);
      if (insertErr.code === "23505") {
        return json({ error: "A staff record with that email already exists" }, 409);
      }
      return json({ error: insertErr.message }, 500);
    }
    return json({ staffId: authId, email: input.email, loginCreated });
  }

  if (!body.staffId) return json({ error: "staffId is required" }, 400);

  const { data: target, error: targetErr } = await admin
    .from("staff")
    .select("id, email, full_name, role, is_active")
    .eq("id", body.staffId)
    .maybeSingle();
  if (targetErr) return json({ error: targetErr.message }, 500);
  if (!target) return json({ error: "No staff row with that id" }, 404);
  if (!target.email) return json({ error: "That staff row has no email address" }, 400);

  if (body.action === "update") {
    const parsed = parseStaffChange(body);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const change = parsed.value;
    if (Object.keys(change).length === 0) return json({ error: "Nothing to change" }, 400);

    const { count, error: countErr } = await admin
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countErr) return json({ error: countErr.message }, 500);

    const blocked = guardAdminChange(me.id, target, change, count ?? 0);
    if (blocked) return json({ error: blocked }, 409);

    const emailChanged = change.email !== undefined && change.email !== target.email.toLowerCase();
    let loginEmailChanged = false;

    if (emailChanged) {
      const { data: clash, error: clashErr } = await admin
        .from("staff")
        .select("id")
        .eq("email", change.email)
        .neq("id", target.id)
        .maybeSingle();
      if (clashErr) return json({ error: clashErr.message }, 500);
      if (clash) return json({ error: "Another staff record already uses that email" }, 409);

      const { data: login } = await admin.auth.admin.getUserById(target.id);
      if (login?.user) {
        const { error: loginErr } = await admin.auth.admin.updateUserById(target.id, {
          email: change.email,
          email_confirm: true,
        });
        if (loginErr) return json({ error: loginErr.message }, 500);
        loginEmailChanged = true;
      }
    }

    const patch: Record<string, unknown> = {};
    if (change.fullName !== undefined) patch.full_name = change.fullName;
    if (emailChanged) patch.email = change.email;
    if (change.title !== undefined) patch.title = change.title;
    if (change.role !== undefined) patch.role = change.role;
    if (change.isActive !== undefined) patch.is_active = change.isActive;

    if (Object.keys(patch).length > 0) {
      const { error: updateErr } = await admin.from("staff").update(patch).eq("id", target.id);
      if (updateErr) {
        if (loginEmailChanged) {
          await admin.auth.admin.updateUserById(target.id, { email: target.email });
        }
        if (updateErr.code === "23505") {
          return json({ error: "Another staff record already uses that email" }, 409);
        }
        return json({ error: updateErr.message }, 500);
      }
    }
    return json({ updated: true, staffId: target.id, loginEmailChanged });
  }

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
