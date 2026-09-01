// Agent 4 — public careers page. Unauthenticated. Server-renders full HTML
// for every route so crawlers see real content in the initial response (the
// exact Taleo failure this replaces: boilerplate-to-crawlers). Reads
// `requisitions` with the service role, filtered to is_published=true and
// is_test=false — the anon/public key is never used here, so there is no
// direct anon table exposure to lock down.
//
// Deploy: supabase functions deploy careers-page --no-verify-jwt
// Routes (path is everything after the function name):
//   GET /                      -> listing (?q=, ?location= filters)
//   GET /jobs/:slug            -> role detail + apply form
//   GET /sitemap.xml           -> sitemap of published roles
//   GET /robots.txt            -> allow-all + sitemap pointer
//
// Production note: map a friendly host (e.g. careers.ventvest.com) to this
// function via your edge/CDN rewrite so robots.txt and sitemap.xml resolve
// at the domain root. That mapping is an infra step outside this repo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildSlug,
  displayCodeFromSlug,
  escapeHtml,
  htmlResponse,
  renderPage,
  slugify,
} from "../_shared/careers-html.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function client() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

type Req = {
  id: string;
  display_code: string;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  status: string;
  opened_date: string | null;
};

function excerpt(text: string | null, len = 200): string {
  if (!text) return "";
  const plain = text.replace(/\s+/g, " ").trim();
  return plain.length > len ? plain.slice(0, len).trimEnd() + "…" : plain;
}

async function fetchPublishedRequisitions(sb: ReturnType<typeof client>) {
  const { data, error } = await sb
    .from("requisitions")
    .select(
      "id, display_code, title, description, location, employment_type, status, opened_date",
    )
    .eq("is_published", true)
    .eq("is_test", false)
    .order("opened_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Req[];
}

function renderListing(base: string, roles: Req[], q: string, location: string): string {
  const filtered = roles.filter((r) => {
    const matchesQ = !q || r.title.toLowerCase().includes(q.toLowerCase());
    const matchesLoc = !location || (r.location ?? "").toLowerCase().includes(location.toLowerCase());
    return matchesQ && matchesLoc;
  });

  const cards = filtered
    .map((r) => {
      const slug = buildSlug(r.title, r.display_code);
      return `<a class="card" href="${base}/jobs/${slug}" style="display:block;text-decoration:none;color:inherit;">
        <h2>${escapeHtml(r.title)}</h2>
        <p class="meta">${escapeHtml(r.location ?? "Location on request")}${
          r.employment_type ? " &middot; " + escapeHtml(r.employment_type) : ""
        }</p>
        <p class="excerpt">${escapeHtml(excerpt(r.description))}</p>
      </a>`;
    })
    .join("\n");

  const body = `
    <form method="get" class="search-row" action="${base}">
      <input type="text" name="q" placeholder="Search roles" value="${escapeHtml(q)}" />
      <input type="text" name="location" placeholder="Location" value="${escapeHtml(location)}" />
      <button class="btn" type="submit">Search</button>
    </form>
    ${
      filtered.length
        ? cards
        : `<div class="card"><p class="excerpt">No open roles match your search right now. Check back soon.</p></div>`
    }
  `;

  return renderPage({
    title: "Careers at VentVest — open roles",
    description:
      "Current open roles at VentVest and our client companies. Apply directly, no account required.",
    canonicalUrl: base,
    bodyHtml: body,
  });
}

function renderPrivacy(base: string): string {
  const body = `
    <div class="card">
      <h2>Privacy notice — VentVest careers applications</h2>
      <p class="meta">Last updated 2026-07-25</p>

      <p class="excerpt"><strong>What we collect.</strong> When you apply for a role through this page, we collect
      the name, email address, phone number, LinkedIn URL (if provided), and resume file you submit, plus the role
      you applied to and the time of submission.</p>

      <p class="excerpt"><strong>Why we collect it.</strong> Solely to evaluate your application: matching you to
      the role, contacting you about next steps, and considering you for other open roles at VentVest or our
      client companies if a recruiter judges it relevant.</p>

      <p class="excerpt"><strong>Who sees it.</strong> Your application is visible only to VentVest recruiting
      staff with a legitimate need to review it. We do not sell, rent, or share your information with third-party
      advertisers, data brokers, or marketing platforms. Your resume file and details never leave VentVest's own
      systems as a result of this application.</p>

      <p class="excerpt"><strong>Where it's stored.</strong> Application data is stored in VentVest's own database
      and file storage, not a third-party recruiting SaaS product.</p>

      <p class="excerpt"><strong>How long we keep it.</strong> We retain applications for as long as reasonably
      useful for hiring purposes. You can ask us to delete your application and resume at any time (see contact
      below), and we'll remove them unless we're required to keep records for a legitimate legal reason.</p>

      <p class="excerpt"><strong>Your choices.</strong> You can ask what information we hold about you, ask us to
      correct it, or ask us to delete it, by emailing the contact below. We'll respond within a reasonable time.</p>

      <p class="excerpt"><strong>Contact.</strong> Questions about this notice or a request about your data:
      <a href="mailto:careers@ventvest.com">careers@ventvest.com</a>.</p>

      <p class="meta" style="margin-top:16px;">This notice covers the careers application form only. It is a plain
      description of our practices, not a substitute for legal advice; VentVest should have this reviewed by
      counsel before relying on it as a binding legal document, particularly for candidates in jurisdictions with
      specific data-protection requirements (e.g. GDPR, Philippine Data Privacy Act).</p>

      <p><a class="btn" href="${base}">Back to open roles</a></p>
    </div>
  `;

  return renderPage({
    title: "Privacy notice — VentVest Careers",
    description: "How VentVest collects, uses, and stores information submitted through the careers application form.",
    canonicalUrl: `${base}/privacy`,
    bodyHtml: body,
  });
}

function renderClosedNotice(base: string): string {
  return renderPage({
    title: "Role closed — VentVest Careers",
    description: "This role is no longer open.",
    canonicalUrl: base,
    bodyHtml: `<div class="card closed-notice">
      <h2>This role has closed</h2>
      <p class="excerpt">It's no longer accepting applications. Have a look at our other open roles.</p>
      <p><a class="btn" href="${base}">View open roles</a></p>
    </div>`,
  });
}

function renderDetail(base: string, applyEndpoint: string, r: Req, slug: string): string {
  const url = `${base}/jobs/${slug}`;
  const structuredData = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: r.title,
    description: r.description ?? r.title,
    datePosted: r.opened_date ?? undefined,
    employmentType: r.employment_type ?? undefined,
    hiringOrganization: {
      "@type": "Organization",
      name: "VentVest",
    },
    jobLocation: r.location
      ? {
          "@type": "Place",
          address: { "@type": "PostalAddress", addressLocality: r.location },
        }
      : undefined,
  };

  const body = `
    <div class="card">
      <h2>${escapeHtml(r.title)}</h2>
      <p class="meta">${escapeHtml(r.location ?? "Location on request")}${
        r.employment_type ? " &middot; " + escapeHtml(r.employment_type) : ""
      }</p>
      <div class="excerpt">${escapeHtml(r.description ?? "").replace(/\n/g, "<br/>")}</div>
    </div>

    <div class="card">
      <h2>Apply</h2>
      <div id="apply-errors" class="error" style="display:none;"></div>
      <form class="apply" id="apply-form" action="${escapeHtml(applyEndpoint)}" method="post" enctype="multipart/form-data">
        <input type="hidden" name="requisition_id" value="${r.id}" />
        <div class="honeypot" aria-hidden="true">
          <label for="company_website">Company website</label>
          <input type="text" id="company_website" name="company_website" tabindex="-1" autocomplete="off" />
        </div>

        <label for="full_name">Full name <span class="required">*</span></label>
        <input type="text" id="full_name" name="full_name" required />

        <label for="email">Email <span class="required">*</span></label>
        <input type="email" id="email" name="email" required />

        <label for="phone">Phone <span class="required">*</span></label>
        <input type="tel" id="phone" name="phone" required />

        <label for="linkedin_url">LinkedIn URL</label>
        <input type="url" id="linkedin_url" name="linkedin_url" placeholder="https://linkedin.com/in/you" />

        <label for="resume">Resume (PDF, DOC, or DOCX, max 10 MB) <span class="required">*</span></label>
        <input type="file" id="resume" name="resume" accept=".pdf,.doc,.docx" required />

        <div class="consent-row">
          <input type="checkbox" id="consent" name="consent" required />
          <label for="consent" style="margin:0;font-weight:400;">
            I agree to VentVest's <a href="${base}/privacy" target="_blank" rel="noopener">privacy notice</a> and consent
            to my information being used to evaluate this application. <span class="required">*</span>
          </label>
        </div>

        <p style="margin-top:16px;"><button class="btn" type="submit" id="apply-submit">Submit application</button></p>
      </form>
      <div id="confirm" class="card" style="border-color:var(--success);">
        <h2>Application received</h2>
        <p class="excerpt">Thanks — a recruiter will review your application and reach out if it's a fit. No further
        action is needed from you right now.</p>
      </div>
    </div>

    <script>
      (function () {
        var form = document.getElementById('apply-form');
        var errBox = document.getElementById('apply-errors');
        var confirmBox = document.getElementById('confirm');
        var submitBtn = document.getElementById('apply-submit');
        if (!form) return;
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          errBox.style.display = 'none';
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting…';
          var fd = new FormData(form);
          fetch(form.action, { method: 'POST', body: fd })
            .then(function (res) {
              return res.json().then(function (data) { return { ok: res.ok, data: data }; });
            })
            .then(function (result) {
              if (result.ok) {
                form.style.display = 'none';
                confirmBox.style.display = 'block';
              } else {
                errBox.textContent = result.data && result.data.message
                  ? result.data.message
                  : 'Something went wrong. Please try again.';
                errBox.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit application';
              }
            })
            .catch(function () {
              errBox.textContent = 'Network error — please try again.';
              errBox.style.display = 'block';
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit application';
            });
        });
      })();
    </script>
  `;

  return renderPage({
    title: `${r.title} — VentVest Careers`,
    description: excerpt(r.description, 155) || r.title,
    canonicalUrl: url,
    structuredData,
    bodyHtml: body,
  });
}

function renderSitemap(base: string, roles: Req[]): string {
  const urls = roles
    .map((r) => `  <url><loc>${escapeHtml(`${base}/jobs/${buildSlug(r.title, r.display_code)}`)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeHtml(base)}</loc></url>
${urls}
</urlset>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Strip the function-name prefix so routing works whether this is called
  // as /functions/v1/careers-page/... or rewritten to a bare domain.
  const path = url.pathname.replace(/^\/(functions\/v1\/)?careers-page/, "") || "/";
  // Edge Functions sit behind multiple proxy hops that terminate TLS
  // upstream; both req.url and x-forwarded-proto were observed reporting the
  // *internal* hop's scheme (http) rather than the real client-facing
  // scheme. This surface is never actually served over plain http, so force
  // https unconditionally rather than trust either signal — canonical/OG
  // URLs and the sitemap must never advertise the wrong scheme. Set
  // CAREERS_PUBLIC_ORIGIN to override entirely once a custom domain is wired up.
  const origin = Deno.env.get("CAREERS_PUBLIC_ORIGIN") ?? `https://${url.host}`;
  const base = `${origin}${url.pathname.replace(/\/(jobs\/.*|sitemap\.xml|robots\.txt|privacy)?$/, "")}`;
  const sb = client();

  try {
    if (path === "/robots.txt") {
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`, {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (path === "/privacy") {
      return htmlResponse(renderPrivacy(base));
    }

    if (path === "/sitemap.xml") {
      const roles = await fetchPublishedRequisitions(sb);
      return new Response(renderSitemap(base, roles), {
        headers: { "content-type": "application/xml; charset=utf-8" },
      });
    }

    if (path.startsWith("/jobs/")) {
      const slug = path.replace("/jobs/", "").replace(/\/+$/, "");
      const displayCode = displayCodeFromSlug(slug);
      if (!displayCode) return htmlResponse(renderClosedNotice(base), 404);

      const { data: role, error } = await sb
        .from("requisitions")
        .select(
          "id, display_code, title, description, location, employment_type, status, opened_date, is_published, is_test",
        )
        .eq("display_code", displayCode)
        .maybeSingle();

      if (error) throw error;
      if (!role || !role.is_published || role.is_test || role.status !== "open") {
        return htmlResponse(renderClosedNotice(base), 200);
      }

      const applyEndpoint = `${origin}/functions/v1/careers-apply`;
      const canonicalSlug = buildSlug(role.title, role.display_code);
      return htmlResponse(renderDetail(base, applyEndpoint, role as Req, canonicalSlug));
    }

    // Listing (default route)
    const roles = await fetchPublishedRequisitions(sb);
    const q = url.searchParams.get("q") ?? "";
    const location = url.searchParams.get("location") ?? "";
    return htmlResponse(renderListing(base, roles, q, location));
  } catch (err) {
    console.error("careers-page error", err);
    return htmlResponse(
      renderPage({
        title: "VentVest Careers",
        description: "Careers at VentVest.",
        canonicalUrl: base,
        bodyHtml: `<div class="card"><p class="excerpt">Something went wrong loading this page. Please try again shortly.</p></div>`,
      }),
      500,
    );
  }
});
