# Goal 6: the cutover runbook, X1 to X12

Written from the code and the config rather than from the plan's summary, so every figure here is re-checkable with the command beside it. Nothing in this document was executed against a hosted project: X1 has not happened, so X2 to X7 have no target yet. What is done here is the part that does not need one.

## What is settled and is not relitigated

The artefact is a static SPA. `vercel.json` is committed with `outputDirectory: app/dist-redesign-2`, the SPA rewrite `/((?!assets/).*)` without which every deep link 404s, immutable asset caching, and a header set whose CSP already allows `https://*.supabase.co`, `wss://*.supabase.co` and `https://accounts.google.com`. `script-src` is `'self'` with no `unsafe-inline`, which the Vite production build satisfies.

Fly is ruled out on its own documentation: static files must be packaged as a container image, so it means maintaining a web server to serve a few dozen files.

## X2: the migration count, and what proves it

**54 migrations**, `ls supabase/migrations/*.sql | wc -l`. They apply cleanly from scratch in order, which `npm run db:reset` exercises on every local run. A fresh project has no ledger to reconcile, which is the reason X1 exists: the live project had ten migrations applied through the MCP connector under generated timestamps against six hand-written repo files, so `supabase db push` refuses with `LegacyDbPushMissingLocalError`.

## X5 and X6: the eleven functions, their JWT setting and their secrets

Derived from `supabase/config.toml` and from every `Deno.env.get` in each function, not from prose. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are platform-provided and are not listed.

| Function | `verify_jwt` | Secrets it reads |
| :---- | :---- | :---- |
| `careers-page` | **false** | `CAREERS_PUBLIC_ORIGIN` |
| `careers-apply` | **false** | `CAREERS_PUBLIC_ORIGIN`, `CAREERS_RATE_LIMIT_PER_HOUR` |
| `careers-status` | **false** | `CAREERS_PUBLIC_ORIGIN` |
| `google-oauth-callback` | **false** | `APP_ALLOWED_ORIGINS`, `APP_SETTINGS_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` |
| `google-sync` | **false** | `APP_PRIMARY_ORIGIN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_SYNC_SECRET` |
| `intake-email-parser` | **false** | `INTAKE_EMAIL_PARSER_SECRET` |
| `google-oauth-start` | true | `APP_PRIMARY_ORIGIN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_REDIRECT_URI` |
| `gmail-send` | true | `APP_PRIMARY_ORIGIN` |
| `calendar-create-meeting` | true | `APP_PRIMARY_ORIGIN` |
| `intake-sheet-fetch` | true | `APP_PRIMARY_ORIGIN` |
| `intake-sheet-commit` | true | `APP_PRIMARY_ORIGIN` |

**Ten secrets to set**, and each one has a consequence if it is missed:

| Secret | Missing it means |
| :---- | :---- |
| `CAREERS_PUBLIC_ORIGIN` | `careers-page` builds its links from `req.url`, whose scheme cannot be trusted behind Supabase's proxy, which is why the function hardcodes `https` |
| `CAREERS_RATE_LIMIT_PER_HOUR` | the public apply endpoint falls back to its built-in default rather than the intended limit |
| `APP_PRIMARY_ORIGIN` | five functions send `Access-Control-Allow-Origin: *`, which is the wrong answer for an authenticated endpoint |
| `APP_ALLOWED_ORIGINS` | `google-oauth-callback` has no allow-list to redirect back to, so the OAuth round trip cannot complete safely |
| `APP_SETTINGS_URL` | the callback falls back to the relative `/settings`, which is not a valid redirect target from Supabase's domain |
| `GOOGLE_OAUTH_CLIENT_ID`, `_SECRET`, `_REDIRECT_URI` | the whole Google integration is dead: no connect, no sync, no send, no meeting |
| `GOOGLE_SYNC_SECRET` | `google-sync` is `verify_jwt=false`, so this secret is the only thing gating it |
| `INTAKE_EMAIL_PARSER_SECRET` | same for the email-parser webhook, and `tests/.env` must carry the same value or `mocks/gmail-calendar-mocked.test.ts` throws at import |

**Six of the eleven run with `verify_jwt=false`**, and that is deliberate rather than an oversight: the careers surface is public, Google's redirect carries no session, and the two webhooks are called by machines. Each of the six is gated another way, by a shared secret or by a state nonce, which is worth restating because "public function" reads like a finding when it is a design.

## X3: the three settings no migration can make

1. **`pg_cron`, and it carries four jobs rather than the two the plan named.** Read from the local stack, `select jobname, schedule from cron.job`:

| Job | Schedule | What stops without it |
| :---- | :---- | :---- |
| `foos-reminder-due` | `* * * * *` | reminders never fire; `public.fn_fire_due_reminders()` has to be called externally |
| `dash-refresh-materialized-views` | `*/15 * * * *` | every dashboard number freezes at its seed value |
| `dash-refresh-success-metrics` | `5,20,35,50 * * * *` | the success-metrics view goes stale on its own cadence |
| `foos-prune-retained` | `17 3 * * *` | `retention_policy` stops being enforced, so `client_errors` and the other retained tables grow without bound |

The last two were not in the plan's summary of this item and are recorded here because a cutover that enables `pg_cron` and checks only the reminder job would leave two of the four silently dead.
2. **`dash` in Data API → Exposed schemas.** Miss this and **every dashboard query returns `PGRST106`**, which is defect QA-001, already recorded once. It gates **seven** views: `vw_ats_funnel`, `vw_crm_funnel`, `vw_requisition_aging`, `vw_source_effectiveness`, `vw_staff_activities`, `vw_staff_grading` and `vw_success_metrics`.
3. **Google OAuth restricted to the ventvest.com hosted domain, with email/password as the fallback.** The test personas sign in with a password, so removing the fallback breaks the suites as well as the demo.

## X10: five checks, each proving a different item

Run these after deploying, not before, and treat a green result as evidence that the configuration took rather than that the page loaded.

| Check | What it proves |
| :---- | :---- |
| Google sign-in completes | X3's OAuth restriction and X4's redirect URLs |
| One dashboard widget renders numbers | `dash` is exposed, so X3 took |
| A deep link such as `/recruit/candidates/<id>` loads on a cold visit | the SPA rewrite, so X7's host config took |
| A row changes and the list updates without a refresh | `wss://` passes the CSP |
| The public careers page lists a role | the six `verify_jwt=false` functions deployed and `CAREERS_PUBLIC_ORIGIN` is right |

The careers check has a known correct-but-surprising outcome: **every seeded requisition is `is_test`, so a seed-only instance shows zero roles**. That is the right answer, not a failure.

## What is Klent's, and is not decided here

- **X1**, create the develop project and hand over the ref.
- **X8**, what data the hosted instance carries. The **72,917** imported candidate records are real people. Seed data only is a legitimate answer, and no real data goes up on my judgement.
- **X11**, whether Vercel's git integration builds on push. The GitHub Actions workflow is disabled at Klent's instruction and stays disabled; Vercel building on push is a separate mechanism and needs its own yes or no.
- **X12**, the host, decided on licensing rather than capability. Vercel Hobby is non-commercial per Vercel's own terms, so this is Pro at $20 per seat per month; Cloudflare Pages serves static assets free. If Cloudflare, `vercel.json`'s rewrite and headers port to `_redirects` and `_headers`, and their commercial terms need reading first.

## X8's numbers, measured rather than quoted

What a cutover would actually carry, from the local stack on 2026-09-07:

| Table | Rows | of which `is_test` |
| :---- | ----: | ----: |
| `people` | **72,988** | 10 |
| `candidate_profiles` | 72,917 | n/a |
| `applications` | 86,133 | n/a |
| `activities` | 213,744 | n/a |
| `companies` | 195 | 5 |
| `requisitions` | 690 | 3 |
| `deals` | 2 | 2 |
| `attachments` | 1,738 | n/a |
| `staff` | 12 | no `is_test` column |

The 72,988 people are the decision. Everything else is small: 195 companies and 690 requisitions are not a privacy question, and `deals` is entirely demo data.

## X9: the purge, if real data goes up

Order matters because of the foreign keys: `people`, `requisitions`, `deals`, `companies`, with the statements in `README.md`. `staff` has no `is_test` column, so the three demo staff (Rita, Sam, Ben) are deleted by hand. Locally that is currently 10 test people and 3 test requisitions, which `validate.sql` checks 9 and 10 assert.

## X12: the host question, answered on licensing, read from the vendors on 2026-09-07

The plan said the Cloudflare terms check had not been done. It has now, and both sides are quoted rather than recalled.

**Vercel Hobby forbids this use, in its own words.** From the Fair Use Guidelines, page last updated 2026-07-29:

> **Hobby teams** are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan.

and, in the same section, commercial usage is defined as any deployment used "for the purpose of financial gain of **anyone** involved in **any part of the production** of the project, including a paid employee or consultant writing the code", with "Receiving payment to create, update, or host the site" given as an example. A recruitment product built under a paid engagement is commercial on that definition twice over.

**Vercel Pro is a $20 platform fee, not simply $20 a seat.** From the Pro plan page, last updated 2026-09-02: "$20/month Pro platform fee", which includes **1 deploying team seat** and **$20/month in usage credit**, with 1 TB Fast Data Transfer and 10,000,000 Edge Requests included. Additional Owner or Member seats are "$20/month each" and Viewer seats are free. So the plan's shorthand of "$20/seat/month" understates what the first $20 buys and overstates the cost of read-only collaborators, and is corrected here.

**Cloudflare Pages carries no equivalent restriction.** Two things had to be checked separately, because the old answer is widely repeated and is out of date.

- The **non-HTML content limit, the old section 2.8, no longer exists**. Cloudflare retired it on 2023-05-16 and moved the restriction into a CDN-specific section aimed at video and large files hosted outside Cloudflare, rather than at "a disproportionate percentage of pictures, audio files, or other non-HTML content". A 1.0 MB JavaScript and CSS bundle was never the target and is not now.
- The **Developer Platform service-specific terms**, last updated 2026-06-02, contain no commercial-use prohibition and no enumeration of permitted content types. The restriction there is on unlawful or harmful content, which is not this.

**And the free tier's numbers are far from binding for this artefact.** Pages free allows **500 builds per month, 20,000 files per deployment, 25 MiB per asset and 100 custom domains**, and static asset requests are, in Cloudflare's own words, "free and unlimited". The build is **34 files, 955,095 bytes, largest 215,735 bytes**: **0.17%** of the 20,000-file limit and **0.82%** of the 25 MiB per-asset limit. The old figure of 41 files at 1.0 MB was wrong; the percentages barely move, which is the point.

**So the fact is settled and the decision is still Klent's.** On capability the two are interchangeable for this bundle. On licensing, Vercel requires a paid plan for this engagement and Cloudflare Pages does not. If Cloudflare, `vercel.json`'s rewrite and headers port to `_redirects` and `_headers`, which is an hour of work, and the CSP moves verbatim.

**Sources**
- Vercel, Fair Use Guidelines, https://vercel.com/docs/limits/fair-use-guidelines, last updated 2026-07-29
- Vercel, Pro plan, https://vercel.com/docs/plans/pro, last updated 2026-09-02
- Cloudflare, Pages limits, https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare, Workers pricing, static assets, https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare, "Goodbye, section 2.8 and hello to Cloudflare's new terms of service", https://blog.cloudflare.com/updated-tos/, 2023-05-16
- Cloudflare, Service-Specific Terms, Developer Platform, https://www.cloudflare.com/service-specific-terms-developer-platform/, last updated 2026-06-02

## An executable X10, rather than a checklist

`scripts/check-cutover.mjs` runs the checks that can be automated against **a target you name explicitly**, and it **skips rather than passes** anything it cannot reach:

```
CUTOVER_SUPABASE_URL=http://127.0.0.1:55321 \
CUTOVER_SUPABASE_ANON_KEY=<anon key for that project> \
node scripts/check-cutover.mjs
```

`--url=` and `--anon=` do the same. `CUTOVER_SERVICE_ROLE_KEY` enables the `pg_cron` check and `CUTOVER_APP_ORIGIN` the two front-end ones. It reads **none** of `SUPABASE_URL`, `VITE_SUPABASE_URL` or `FOOS_SUPABASE_URL`, and it **refuses the live ref `mebfbbvrqdctamnzvbbs`** unless `--allow-live` is passed. Both of those are consequences of the incident recorded below, not preferences.

| Check | How it decides |
| :---- | :---- |
| `dash` exposed | selects from `dash.vw_ats_funnel` through PostgREST. `PGRST106` is the failure; a permission error counts as a pass, because that means the schema is reachable and RLS is doing its job |
| each of the 11 functions | `OPTIONS` to `/functions/v1/<name>` with `redirect: 'manual'`. Anything but a 404 means deployed. A 404 is then read further, because a deployed function is allowed to answer 404 itself: absent only if the gateway says so, which is `sb-error-code: NOT_FOUND`, a `"code": "NOT_FOUND"` body, or the local runtime's plain `Function not found` |
| `pg_cron` | needs SQL access rather than PostgREST, so without the service role it reports skipped and names the query to run: `select jobname from cron.job` |
| the SPA rewrite | with `CUTOVER_APP_ORIGIN` set, fetches a deep candidate URL and asserts the response is 200 and contains the app root element |
| the careers page | fetches `careers-page` and asserts 200 |

The design rule is the one this session has had to learn twice: **a check that cannot run must say so, not pass.** Every skipped line prints why and what to set.

### It was exercised, it hit the wrong project, and that is why it now refuses to guess

The first version read `SUPABASE_URL ?? VITE_SUPABASE_URL ?? FOOS_SUPABASE_URL`. There is no root `.env` in this checkout, so the second name won, and `app/.env` holds `VITE_SUPABASE_URL=https://mebfbbvrqdctamnzvbbs.supabase.co`. **The run on 2026-09-07 that this section previously described as "exercised against the local stack" was against the live project.** The response headers said so and I did not read them until the second run: `sb-project-ref: mebfbbvrqdctamnzvbbs`.

What it actually did there: one `select * from dash.vw_ats_funnel limit 1` through PostgREST as `anon`, which was refused, and one `OPTIONS` per function. **No writes, and the anon role could not have made one.** It is still a breach of the rule that this work stays on the local stack, and it is recorded rather than quietly fixed.

Two defects in the script came out of it, both real:

1. **It guessed its target, and guessed production.** A cutover check is aimed at a specific project by definition, so guessing is wrong even when it guesses right. It now requires `CUTOVER_SUPABASE_URL` and `CUTOVER_SUPABASE_ANON_KEY`, ignores the other three naming conventions entirely, and refuses the live ref without `--allow-live`. That mirrors `migration/import.mjs`, `purge-zoho-import.mjs` and the other repair tools, which all refuse a non-local target unless told.
2. **It followed redirects, so it misreported a working function as missing.** `fetch` follows a 302 by default. `google-oauth-callback` answers `OPTIONS` with a 302, the redirect was followed to something that 404s, and the check reported the function absent. Every fetch now passes `redirect: 'manual'`.

A third thing the wrong-project run exposed, which was not a defect: **`careers-status` really is not deployed to the live project**, and `careers-page` and `google-oauth-callback` are. That matches the migration ledger, where everything from 2026-09-01 onwards exists locally and in git only.

**Against the local stack, named explicitly, all twelve reachable checks pass:**

```
target http://127.0.0.1:55321

ok   dash exposed to the Data API       reachable, refused by RLS as it should be: permission denied for schema dash
ok   function careers-page              OPTIONS -> 200
ok   function careers-apply             OPTIONS -> 204
ok   function careers-status            OPTIONS -> 204
ok   function google-oauth-start        OPTIONS -> 204
ok   function google-oauth-callback     OPTIONS -> 302
ok   function google-sync               OPTIONS -> 204
ok   function gmail-send                OPTIONS -> 204
ok   function calendar-create-meeting   OPTIONS -> 204
ok   function intake-sheet-fetch        OPTIONS -> 204
ok   function intake-sheet-commit       OPTIONS -> 204
ok   function intake-email-parser       OPTIONS -> 405
FAIL pg_cron scheduled jobs             CUTOVER_SERVICE_ROLE_KEY not set, so this check was skipped rather than passed
FAIL SPA rewrite on a deep link         CUTOVER_APP_ORIGIN not set, so this check was skipped rather than passed
FAIL public careers page                CUTOVER_APP_ORIGIN not set, so this check was skipped rather than passed

12 of 15 cutover check(s) pass.
```

Three things reading the script would not have told you. The `dash` probe comes back **permission denied for schema dash**, which the check counts as a **pass**: the schema is exposed and reachable, and RLS is refusing an anonymous read as it should. The failure to look for is `PGRST106`, which means the schema is not exposed at all. The functions answer `200`, `204`, `302` and `405` to an `OPTIONS` and all four mean deployed. And the absent-versus-deployed rule was proved in both directions rather than assumed:

```
no-such-function     gateway says absent
careers-status       deployed, OPTIONS -> 204
```

The three `FAIL` lines are the design rule working, not a problem: **a check that cannot run says so rather than passing.** Each names what to set.

**There is no root `.env` in this checkout**, and knowing which file holds what matters here more than usual: `app/.env` carries `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` **and points at the live project**, `tests/.env` carries the `FOOS_` pair and points at `http://127.0.0.1:55321`, and `supabase/functions/.env` carries four function secrets. `source .env` from the repository root succeeds and sets nothing, which is what produced `Error: supabaseUrl is required.` at `validateSupabaseUrl`. The check reads none of them, on purpose.

## If Cloudflare: the port is done, and the first version of it would have broken the site

`_headers` and `_redirects` are in `docs/07-environments/cloudflare/`, ready to drop into the build output. `_headers` is generated from `vercel.json`'s own JSON, so the CSP and the header set cannot drift from the Vercel copy.

**`_redirects` was wrong on 2026-09-07 and is now deliberately empty of rules.** The first version carried the obvious port, `/* /index.html 200`, and this section claimed "Cloudflare Pages serves an existing static file before consulting `_redirects`, so the exclusion is unnecessary". Cloudflare's own documentation says the opposite:

> Redirects are always followed, regardless of whether or not an asset matches the incoming request.
>
> `developers.cloudflare.com/pages/configuration/redirects/`, read 2026-09-07

Vercel's rewrite source is `/((?!assets/).*)`, a negative lookahead that excludes the hashed bundle; `_redirects` has no lookahead. So `/*` would have proxied every request for `/assets/index-<hash>.js` to `index.html`, and the app would have served HTML where the browser expected JavaScript. The claim was not merely imprecise, it inverted the behaviour.

**No rule is needed, because Pages already does this and does it correctly:**

> If your project does not include a top-level `404.html` file, Pages assumes that you are deploying a single-page application. This includes frameworks like React, Vue, and Angular. Pages' default single-page application behavior matches all incoming paths to the root (`/`), allowing you to capture URLs like `/about` or `/help` and respond to them from within your SPA.
>
> `developers.cloudflare.com/pages/configuration/serving-pages/`, read 2026-09-07

The build satisfies the precondition: `find app/dist-redesign-2 -maxdepth 1 -name '*.html'` returns `index.html` and nothing else, and there is no `404.html` anywhere in the output. `_redirects` therefore holds only comments, which Cloudflare supports (`Lines starting with a # will be treated as comments`), and those comments say why the catch-all must not be added back.

**Two more differences the port had to handle, both from the headers documentation:**

- **Pages adds `Access-Control-Allow-Origin: *` to every static asset response by default and Vercel does not.** A straight port would have quietly widened CORS across the whole origin. `_headers` detaches it with `! Access-Control-Allow-Origin`, using the documented detach syntax. `Referrer-Policy` is the same shape with a smaller consequence: Pages defaults to `strict-origin-when-cross-origin` and the rule replaces it with `no-referrer`.
- **A deep link's response does not match the `/index.html` rule.** The SPA fallback answers `/recruit/candidates/<id>` from `index.html` without changing the URL, so `Cache-Control: no-cache` does not apply to it; it gets Cloudflare's default `public, max-age=0, must-revalidate`, which has the same effect. A `/` rule was added for the root. Stated rather than left to be discovered.

Against the documented limits: `_headers` uses **4 rules of the 100 allowed** with a longest line of **500 characters of the 2,000 allowed**; `_redirects` uses **0 of 2,100**.

**The honest summary of this section: the Vercel config is verified against Vercel's schema and committed, and the Cloudflare port is verified against Cloudflare's documentation but has never been deployed.** Neither has served a request.

## What this runbook does not answer, stated rather than left implied

- **Whether the hosted instance works.** Nothing here has run against a hosted project, because X1 has not happened. Every figure is from the repository or the local stack, and every check is written to skip rather than pass when it cannot reach a target.
- ~~**The build's exact output.**~~ **Measured 2026-09-07, and the plan's figure was wrong.** It recorded "41 files at 1.0 MB with the largest at 212 KB". A fresh `npm run build --workspace=app` writes **34 files** totalling **955,095 bytes** (0.91 MiB, 0.96 MB), largest `assets/vendor-supabase-wIXNjVJv.js` at **215,735 bytes**, in 990ms. Twenty-nine files are in `assets/`; the other five are `index.html`, `favicon.png`, `apple-touch-icon.png`, `og-careers.png` and `ventvest-logo.webp`. Re-measure with `find app/dist-redesign-2 -type f | wc -l` and `find app/dist-redesign-2 -type f -exec stat -f%z {} + | awk '{s+=$1} END{print s}'`. Fewer files and fewer bytes than claimed, so nothing about either host's limits changes.
- **Whether Vercel's git integration should build on push.** X11, and Klent's. The GitHub Actions workflow stays disabled at his instruction; Vercel building on push is a separate mechanism that needs its own answer.
- **What `supabase migration list --linked` says today.** The last reading, on 2026-09-01, showed an empty remote for the ten `20260901*` migrations that existed then. `CLAUDE.md` said "eight" until 2026-09-07 and that was wrong; there are ten of those files, and thirty-six dated 2026-09-01 or later. The command talks to the live project, and this session's standing instruction is that everything happens on the local stack, so it was not re-run: read it yourself before the first deploy.
