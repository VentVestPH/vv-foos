# Careers page + apply intake — Agent 4

Two Supabase Edge Functions, no auth, served alongside the internal app per
the architecture doc's stack section. Both use the service role key
server-side; the anon/public key is never used on this surface, so there's
no direct anon table exposure to lock down.

## Functions

- **`careers-page`** — server-rendered HTML: role listing (`/`), role detail
  (`/jobs/:slug`), `sitemap.xml`, `robots.txt`. Every route returns full
  content in the initial HTML response (no client-side render required for
  crawlers) — deliberately avoids the Taleo failure where crawlers indexed
  boilerplate.
- **`careers-apply`** — POST-only JSON API behind the detail page's apply
  form. Validates, rate-limits, dedups, and writes `intake_items` →
  `people`/`applications`/`attachments` in one sequential flow, with the
  intake row left recoverable if a later write fails (see inline comments
  for the exact order).

## Deploy status: live

Deployed 2026-07-25 to the "Front Office OS" Supabase project
(`mebfbbvrqdctamnzvbbs`) via the Supabase MCP connector (no local Supabase
CLI/Deno available in the build environment, so this went straight to the
linked project rather than through `supabase functions deploy`):

- Migration `20260725000001_careers.sql` applied (rate-limit table + dedup
  RPCs).
- `careers-page` live at
  `https://mebfbbvrqdctamnzvbbs.supabase.co/functions/v1/careers-page`
  (routes: bare path = listing, `/jobs/:slug`, `/privacy`, `/sitemap.xml`,
  `/robots.txt`), `verify_jwt=false`.
- `careers-apply` live at
  `https://mebfbbvrqdctamnzvbbs.supabase.co/functions/v1/careers-apply`,
  `verify_jwt=false`.
- Smoke-tested: listing, robots.txt, sitemap.xml, privacy, and a role-closed
  response all render correctly. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  are present automatically as platform-provided function secrets.
- Fixed during smoke-testing: `req.url`'s origin (and even
  `x-forwarded-proto`) reported the scheme of an internal proxy hop (`http`)
  rather than the real public scheme. The code now hardcodes `https` for all
  canonical/OG/sitemap URLs rather than trusting either signal; set
  `CAREERS_PUBLIC_ORIGIN` as a function secret to override once a custom
  domain (e.g. `careers.ventvest.com`) is wired up.
- The three seeded requisitions are all `is_test = true`, so the live
  listing correctly shows zero roles right now — that's the `is_test` filter
  working as designed, not a bug. To see a role end to end, either publish a
  real non-test requisition or flip one seed row's `is_test` to `false`
  temporarily for a demo (remember to flip it back — the test-data purge
  before cutover assumes seed rows stay flagged).
- **Not yet done:** a full live click-through of the apply form (would
  create a real, non-test `people`/`applications`/`attachments` row against
  the shared demo dataset) and Agent 8's automated test suite. Recommend
  running the Gate 3 demo script below once John has a requisition ready to
  test against.

To redeploy after further changes, use the Supabase MCP connector's
`deploy_edge_function` (project id `mebfbbvrqdctamnzvbbs`) or, once a local
dev environment has the Supabase CLI:

```sh
cd foos
supabase functions deploy careers-page --no-verify-jwt
supabase functions deploy careers-apply --no-verify-jwt
supabase db push
```

`--no-verify-jwt` is required on both — this surface has no signed-in user,
by design. Never expose the service role key to the browser.

Production routing: point a friendly host (e.g. `careers.ventvest.com`) at
`careers-page` via your edge/CDN rewrite so `robots.txt` and `sitemap.xml`
resolve at the domain root, and point the apply form's fetch target at
`careers-apply` under the same or a CORS-allowed origin. That rewrite is
infra configuration outside this repo.

## Known gaps / follow-ups for John

- **Privacy notice.** `careers-page` now serves a real `/privacy` page
  (plain-language notice on what's collected via the apply form, why, who
  sees it, retention, and a contact address) and the apply form's consent
  link points at it. It explicitly flags itself as not yet reviewed by
  counsel — recommend a legal pass before treating it as VentVest's binding
  policy, particularly for candidates in jurisdictions with specific
  data-protection rules (GDPR, PH Data Privacy Act). The contact address
  (`careers@ventvest.com`) is a placeholder; confirm or swap it.
- **Search is a full page reload**, not live-filtered like the internal
  app's `ListPage` component — intentional for a no-JS-required, crawler-safe
  surface, but flag if you want client-side live search added as
  progressive enhancement.
- **Honeypot hits are logged to function logs only** (`console.warn`), not
  persisted to a table. Fine for now; if spam volume warrants tuning, add a
  `careers_honeypot_log` table the same way `careers_rate_limit` was added.
- **Rate limit is per-IP only** (5/hour, override via `CAREERS_RATE_LIMIT_PER_HOUR`
  env var) — no distributed/proxy-aware IP detection beyond
  `x-forwarded-for` / `cf-connecting-ip`. Reasonable for launch volume.
- **Design tokens are duplicated**, not imported, in
  `_shared/careers-html.ts` — this surface doesn't share a build step with
  the Vite app. If `app/src/styles/tokens.css` changes, update both files in
  the same commit (flagged here so it isn't missed).
- **Live but not fully click-through tested.** Deployed and smoke-tested
  (see "Deploy status: live" above), but the actual apply-form submission
  path hasn't been exercised against a real requisition yet. QA's Agent 8
  brief already expects to build the automated careers-flow test in
  Phase 4; recommend the manual click-through below first.

## Gate 3 demo script (run on `is_test = true` data where possible)

1. In the ATS module, publish a requisition (`is_published = true`,
   `status = open`). Note its title.
2. Visit the deployed careers listing URL — the role appears with title,
   location, employment type, and a description excerpt only (no pay
   fields, no client company name).
3. Click into the role — URL is a readable slug; view source shows a
   populated `<title>`, meta description, Open Graph tags, and a
   `JobPosting` JSON-LD block with real field values, not placeholders.
4. Visit `/sitemap.xml` — the role's URL is listed. Visit `/robots.txt` — it
   allows crawling and points at the sitemap.
5. Unpublish the requisition — refresh the listing (gone), the direct role
   URL (now a "role closed" page, not a 404), and the sitemap (gone). Then
   re-publish it for the rest of the demo.
6. On a 375px-wide viewport (or phone), fill the apply form: name, email,
   phone, resume (a real PDF), check consent, submit. Confirm it completes
   without horizontal scroll and shows the confirmation panel in place of
   the form.
7. In the ATS module, open that requisition's pipeline — the new
   application appears at stage `received`, source `Careers page`, and the
   requisition's unviewed counter increments. Open the candidate — the
   counter drops.
8. Submit the same email against the same role again — confirm exactly one
   application exists afterward (no duplicate).
9. Try the honeypot: submit with the hidden `company_website` field
   populated via devtools — confirm the response looks like success but no
   `intake_items`, `people`, or `applications` row was created.
10. Attempt a 6th submission from the same network within an hour — confirm
    a polite rejection message, no CAPTCHA.
11. Attempt to upload a renamed `.exe` as the resume — confirm server-side
    rejection with a clear message. Attempt a 12 MB PDF — confirm rejection
    citing the 10 MB limit.
12. Leave consent unchecked and try to submit — confirm the browser blocks
    it (required attribute) and, if bypassed via devtools, the server also
    rejects it.

## Acceptance criteria mapping (brief section, this build)

All acceptance criteria from `VVPH_VV-FOOS_Brief_Agent-4-Careers-Page` are
addressed in code (listing/detail filtering, SEO/structured data, one
intake→person→application→attachment write path, unviewed-queue integration
via existing triggers, dedup, honeypot + rate limit, file validation,
consent gate, mobile-width form, no leaked pay/company fields). None have
been exercised against a live deployment yet — that verification is the
first item in the demo script above once this is deployed.
