import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, htmlResponse, renderPage } from "../_shared/careers-html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_ORIGIN = Deno.env.get("CAREERS_PUBLIC_ORIGIN") ?? "";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Status = {
  reference: string;
  role_title: string;
  location: string | null;
  applied_on: string;
  headline: string;
  detail: string;
  closed: boolean;
};

function client() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function canonical(req: Request, token: string): string {
  if (PUBLIC_ORIGIN) return `${PUBLIC_ORIGIN}/careers-status?token=${token}`;
  const url = new URL(req.url);
  return `https://${url.host}${url.pathname}?token=${token}`;
}

function notFound(req: Request): Response {
  return htmlResponse(
    renderPage({
      title: "Application not found",
      description: "That application status link is not valid.",
      canonicalUrl: canonical(req, ""),
      bodyHtml: `
        <h2>We could not find that application</h2>
        <p>The link may be incomplete, or the application may have been removed at the
        applicant's request. Check the link in your confirmation, or reply to the
        recruiter who contacted you.</p>
      `,
    }),
    404,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "GET") {
    return htmlResponse("<h2>Method not allowed</h2>", 405);
  }

  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!UUID.test(token)) return notFound(req);

  const { data, error } = await client().rpc("fn_application_status", { p_token: token });
  if (error) {
    console.error("careers-status: lookup failed", error);
    return htmlResponse("<h2>Something went wrong</h2><p>Please try again shortly.</p>", 500);
  }

  const status = (Array.isArray(data) ? data[0] : data) as Status | undefined;
  if (!status) return notFound(req);

  const where = status.location ? ` &middot; ${escapeHtml(status.location)}` : "";
  const body = `
    <h2>${escapeHtml(status.headline)}</h2>
    <p class="lede">${escapeHtml(status.detail)}</p>
    <dl>
      <dt>Role</dt><dd>${escapeHtml(status.role_title)}${where}</dd>
      <dt>Reference</dt><dd>${escapeHtml(status.reference)}</dd>
      <dt>Applied</dt><dd>${escapeHtml(status.applied_on)}</dd>
    </dl>
    ${
      status.closed
        ? "<p>This application is closed. You are welcome to apply for other roles.</p>"
        : "<p>This page updates as your application moves. There is nothing you need to do.</p>"
    }
  `;

  return htmlResponse(
    renderPage({
      title: `${status.headline} — ${status.role_title}`,
      description: "Your application status.",
      canonicalUrl: canonical(req, token),
      bodyHtml: body,
    }),
  );
});
