# Goal 6: the cutover runbook

Written from the code and the config rather than from the plan's summary, so every figure here is re-checkable with the command beside it.

**Three decisions were open when this was written and are now closed. Recorded 2026-09-14.**

| Item | Decision |
| :---- | :---- |
| Host | **Cloudflare Pages.** Vercel is not used and `vercel.json` is deleted. The vendor comparison that used to occupy this document is removed with it |
| Supabase plan | **Pro** |
| Environments | **Two, and only two: a developer's local stack, and the Cloudflare Pages site.** There is no develop project, no staging and no preview environment |

That collapses four of the twelve X items. **X1 and X2** assumed creating a fresh project and applying migrations to it; the existing Singapore project `hilieyehhecrlccdveta` is the one environment and already carries the data. **X12**, the host, is answered above. **X11** is narrowed rather than closed: with no preview environment there are no preview deploys to gain, so the only question left is whether the Cloudflare Pages git integration builds production on push. That is still Klent's.

**What remains is X3 to X10**, and all of it is Supabase-side configuration plus one verification pass. None of it has been done.

One correction to how this used to read. This paragraph said "nothing in this document was executed against a hosted project", and the first real run of `scripts/check-cutover.mjs` had already gone to the live project by reading `VITE_SUPABASE_URL` out of `app/.env`. It made read-only requests as `anon`, all refused or informational, and it is written up as QA-017 in `tests/DEFECT_LOG.md`. The script now refuses to guess a target at all.

**Nothing here has served a request from a hosted origin.**

## What is settled and is not relitigated

The artefact is a static SPA, **34 files and 955,154 bytes**, largest 215,735. The header set and CSP live in `app/public/_headers`, which `vite build` emits into `app/dist/`. The CSP allows `https://*.supabase.co`, `wss://*.supabase.co` and `https://accounts.google.com`; `script-src` is `'self'` with no `unsafe-inline`, which the Vite production build satisfies.

Two row counts in this document are easy to confuse and are both correct: **73,096 `people`** and **73,022 `candidate_profiles`**, measured 2026-09-14. A person can exist without a candidate profile, which is why X8's decision is stated against `people` while the plan's privacy language names candidate records.

## X2: the migration count, and what proves it

**54 migrations**, `ls supabase/migrations/*.sql | wc -l`. A fresh project has no ledger to reconcile, which is the reason X1 exists: the live project had ten migrations applied through the MCP connector under generated timestamps against six hand-written repo files, so `supabase db push` refuses with `LegacyDbPushMissingLocalError`.

### X2 was rehearsed rather than asserted, on 2026-09-07

Saying "`npm run db:reset` exercises this on every local run" is true but is not a rehearsal of X2, because `db:reset` also seeds and it destroys the working database, which currently holds the imported corpus. So the run went into a scratch database on the same local Postgres instead:

```
createdb foos_x2_rehearsal on 127.0.0.1:55322 (PostgreSQL 17.6)
psql -f supabase/tests/local_shim.sql        -> shim ok
54 migrations applied in lexical order       -> ok 1..54, failed 0
```

Every one of the 54 applied with `ON_ERROR_STOP=1` into an empty database, with no Supabase services present beyond what `local_shim.sql` stubs: the `anon`, `authenticated` and `service_role` roles, the `auth` schema, and `auth.uid()` / `auth.jwt()`. The scratch database was dropped afterwards. **This is the strongest evidence available without X1**: it proves the migrations are self-contained and order-correct, and it does not prove anything about a Supabase project's own extensions or the Dashboard settings, which is what X3 is for.

**One finding that changes X10, and it would have been discovered the hard way.** `validate.sql` is **not** a schema-only check, so it cannot be used as a smoke test straight after X2. Against the freshly migrated scratch database it stops at the fourth check:

```
NOTICE:  PASS 1: all 24 expected tables exist
NOTICE:  PASS 2: RLS enabled on every public table
NOTICE:  PASS 3: all required triggers exist
ERROR:  FAIL 4: seed requisition REQ-0001 not found
```

**3 of its 34 checks are structural and 31 need seed data.** After applying migrations to the new project, either seed it or expect `validate.sql` to fail at check 4; a failure there says nothing about the migrations. The three structural checks are worth running on their own, because between them they assert all 24 tables, RLS on every one, and every required trigger.

**And the check count itself was wrong.** `scripts/gate.sh` printed `35 check(s) pass` because it counted `PASS` lines, and check 15 prints two, one for the intake-item teardown and one for the reminder teardown. Two checks also carry letter suffixes, `5b` and `14b`, so the numbered labels run to 32 while the distinct checks number **34**. The gate now counts distinct labels and prints 34.

## X5 and X6: the twelve functions, their JWT setting and their secrets

Derived from `supabase/config.toml` and from every `Deno.env.get` reachable from each function, not from prose. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are platform-provided and are not listed.

**Corrected 2026-09-07.** The first version of this table read only each function's own `index.ts` and therefore missed what `_shared/` reads on its behalf. `careers-page` and `careers-status` both import `_shared/careers-html.ts`, which reads `APP_PRIMARY_ORIGIN`, so two cells were short and the secrets table undercounted that variable's reach as five functions when it is eight. The `verify_jwt` column was checked against `config.toml` and is right: six blocks set it false, and the other five functions have no block, so they take the default of true.

`_shared/` now holds two modules and only one of them touches configuration. `careers-html.ts` reads `APP_PRIMARY_ORIGIN`; `mime-header.ts`, added the same day for QA-006, reads nothing (`grep -c Deno.env` returns 0), which is why it can be unit-tested from vitest while `careers-html.ts` cannot. The three import edges are `careers-page` and `careers-status` to `careers-html.ts`, and `google-sync` to `mime-header.ts`. **No secret was added or removed**, so the table above and the count of ten still stand.

| Function | `verify_jwt` | Secrets it reads |
| :---- | :---- | :---- |
| `careers-page` | **false** | `CAREERS_PUBLIC_ORIGIN`, `APP_PRIMARY_ORIGIN` (via `_shared/careers-html.ts`) |
| `careers-apply` | **false** | `CAREERS_PUBLIC_ORIGIN`, `CAREERS_RATE_LIMIT_PER_HOUR` |
| `careers-status` | **false** | `CAREERS_PUBLIC_ORIGIN`, `APP_PRIMARY_ORIGIN` (via `_shared/careers-html.ts`) |
| `google-oauth-callback` | **false** | `APP_ALLOWED_ORIGINS`, `APP_SETTINGS_URL`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` |
| `google-sync` | **false** | `APP_PRIMARY_ORIGIN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_SYNC_SECRET` |
| `intake-email-parser` | **false** | `INTAKE_EMAIL_PARSER_SECRET` |
| `google-oauth-start` | true | `APP_PRIMARY_ORIGIN`, `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_REDIRECT_URI` |
| `gmail-send` | true | `APP_PRIMARY_ORIGIN` |
| `calendar-create-meeting` | true | `APP_PRIMARY_ORIGIN` |
| `intake-sheet-fetch` | true | `APP_PRIMARY_ORIGIN` |
| `intake-sheet-commit` | true | `APP_PRIMARY_ORIGIN` |

**The two origin variables point at different hosts, and swapping them is the easy mistake.**

- `CAREERS_PUBLIC_ORIGIN` is the origin the **careers pages are served from**, which is the Supabase Functions origin unless a custom domain fronts it. **Two** functions fall back to `https://${url.host}` when it is unset, `careers-page/index.ts:320` and `careers-status/index.ts:29`, and the hardcoded `https` is in both because `req.url`'s scheme cannot be trusted behind Supabase's proxy. `CLAUDE.md` and the earlier draft of this section named only `careers-page`. It builds the canonical URL, the sitemap and `robots.txt` from it, so a wrong value produces a site that indexes itself under a hostname that does not serve it.
- `APP_PRIMARY_ORIGIN` is the **frontend host's** origin, Cloudflare Pages. Five authenticated functions use it as their CORS allow-origin, so it has to match the origin the browser is on. `_shared/careers-html.ts:87` also uses it to build `${origin}/og-careers.png`, and `og-careers.png` is one of the 34 files the frontend build emits, so that link only resolves if this points at the frontend and not at Supabase.

Setting both to the same value works for CORS and quietly breaks either the careers canonical URLs or the Open Graph image, depending on which value you pick.

**Ten secrets to set**, and each one has a consequence if it is missed:

| Secret | Missing it means |
| :---- | :---- |
| `CAREERS_PUBLIC_ORIGIN` | `careers-page` builds its links from `req.url`, whose scheme cannot be trusted behind Supabase's proxy, which is why the function hardcodes `https` |
| `CAREERS_RATE_LIMIT_PER_HOUR` | the public apply endpoint falls back to its built-in default rather than the intended limit |
| `APP_PRIMARY_ORIGIN` | **eight** functions read it, not five, and the consequence splits. For the five authenticated ones plus `google-oauth-start` and `google-sync` it means `Access-Control-Allow-Origin: *`, which is the wrong answer for an authenticated endpoint. For `careers-page` and `careers-status` it reaches `_shared/careers-html.ts`, where it builds the Open Graph image URL, so a missing value drops the preview card from every shared careers link and breaks nothing else |
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
2. **`dash` in Data API → Exposed schemas.** Miss this and **every dashboard query returns `PGRST106`**, which is defect QA-001, already recorded once. It gates **seven views**, `vw_ats_funnel`, `vw_crm_funnel`, `vw_requisition_aging`, `vw_source_effectiveness`, `vw_staff_activities`, `vw_staff_grading` and `vw_success_metrics`, which read from **three materialized views**, `mv_staff_stage_advances`, `mv_stage_durations` and `mv_success_metrics`. Ten objects in the schema, and the split matters: the materialized views are what `dash-refresh-materialized-views` and `dash-refresh-success-metrics` refresh, so exposing the schema without `pg_cron` gives dashboards that answer and never change. Counted with `select table_name from information_schema.views where table_schema='dash'` and `select matviewname from pg_matviews where schemaname='dash'`.
3. **Google OAuth restricted to the ventvest.com hosted domain, with email/password as the fallback.** The test personas sign in with a password, so removing the fallback breaks the suites as well as the demo.

**What actually enforces the domain, checked rather than assumed.** `LoginPage.tsx:31` sends `queryParams: { hd: 'ventvest.com' }`, and that is a **hint to Google's account chooser, not a restriction**: a caller who constructs the request without it is not blocked by anything in this repository. There is no server-side domain check in any migration or Edge Function; `grep -rn "ventvest.com" supabase/migrations/ supabase/functions/*/index.ts` finds only two strings in the careers page's markup. So the restriction has to be configured on the provider, which is exactly why X3 lists it as a Dashboard setting rather than as code.

**Missing it is not a data breach, and the reason is worth knowing.** `get_my_role()` is `select role::text from staff where id = auth.uid() and is_active`, so a session with no `staff` row gets `NULL`, and RLS is deny-by-default. Exercised on the local stack as `authenticated` with an unknown `sub`:

```
get_my_role => NULL
people visible => 0
requisitions visible => 0
companies visible => 0
deals visible => 0
```

An unrestricted provider therefore lets a stranger reach the login screen and obtain an empty application, not any data. That is a defence in depth rather than a reason to skip the setting, and it is the same mechanism behind the "Account not provisioned" flash logged as W24.

## X4 and X7: the redirect URLs, and the one that a preview deploy breaks

**What the app asks for.** `app/src/auth/LoginPage.tsx:31` sends `redirectTo: window.location.origin`, so the value Supabase is asked to redirect to is whatever origin served the page. There is no hardcoded callback in the frontend.

**What the local config allows, and why it is not a template for the hosted one.** `supabase/config.toml:180-184`:

```
site_url = "http://localhost:5175"
additional_redirect_urls = ["http://localhost:5175", "http://127.0.0.1:5175"]
```

The comment above it in the file is the part that matters: `A list of *exact* URLs that auth providers are permitted to redirect to post authentication`. Two exact URLs cover a local dev server on either loopback name.

**A preview deployment gets a new origin every time**, so an exact list cannot cover them: whatever is enumerated today does not match the next deploy's hostname, and sign-in on a preview fails while production works. Set the production origin exactly and cover previews with a pattern in the Dashboard's redirect-URL list rather than by adding hostnames one at a time. This is the failure that looks like "OAuth is broken" and is in fact "this origin was not on the list".

**X7 is the same origin from the other side.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` go into the host's environment, and `lib/supabase.ts` throws at boot if either is absent, so a missing variable is a blank page rather than a degraded one. Both are baked into the bundle at build time, which is why changing them needs a rebuild and not just a restart.

**The bundle in this tree currently points at the live project, and that is worth knowing before anyone deploys it.** Vite loads `app/.env.development` at higher priority than `app/.env` in dev mode, which is the only reason `npm run dev` talks to `http://127.0.0.1:55321`; there is **no `app/.env.production`**, so `npm run build` falls back to `app/.env` and bakes `https://mebfbbvrqdctamnzvbbs.supabase.co`. Verified both ways rather than assumed:

```
curl -s http://localhost:5175/src/lib/supabase.ts | grep -oE 'https?://[a-z0-9.:]+'
  http://127.0.0.1:55321

grep -ohoE 'https://[a-z0-9]+\.supabase\.co' app/dist/assets/*.js | sort -u
  https://mebfbbvrqdctamnzvbbs.supabase.co
```

So `app/dist` is a **local build artefact, not a deployable one**. On the host, X7 is satisfied by setting the two variables in the host's own environment, which overrides any `.env` in the repository; the alternative, an `app/.env.production` committed alongside the others, would put a project ref in git and is not recommended.

**The CSP was checked against what the app actually loads, rather than assumed to fit.** Every absolute URL in `app/src` was listed and classified:

| What the app references | CSP directive that governs it | Covered |
| :---- | :---- | :---- |
| `https://<ref>.supabase.co` REST, Auth, Storage and Functions | `connect-src 'self' https://*.supabase.co` | yes |
| `wss://<ref>.supabase.co` Realtime | `connect-src ... wss://*.supabase.co` | yes |
| The one dynamic frame, `engagement.tsx:605` `<iframe src={url}>` with a Storage signed URL | `frame-src 'self' blob: https://*.supabase.co` | yes, and this is why `blob:` and `supabase.co` are in that directive |
| `google.com/search` and `linkedin.com/search` on the candidate record, and `docs.google.com` in the sheet import | none: they are `<a target="_blank" rel="noreferrer">` top-level navigations, which no directive here restricts | not applicable |
| `googleapis.com/auth/...` in `settings/lib.ts` | none: these are OAuth **scope identifiers**, compared as strings and never fetched | not applicable |
| `accounts.google.com` during sign-in | a top-level navigation, but `connect-src` lists it anyway | yes, belt and braces |

The two images the app serves itself, `/ventvest-logo.webp` at `LoginPage.tsx:56` and `UtilityHeader.tsx:47`, are same-origin. **Nothing the app loads falls outside the committed CSP**, which is worth knowing because a CSP that blocks a real request fails at runtime with a console error and no visible symptom.

**`script-src 'self'` with no `'unsafe-inline'` is satisfied, checked against the built file rather than assumed.** `app/dist/index.html` contains exactly **one** `<script>`, with a `src` of `/assets/index-<hash>.js`, and **zero** inline script bodies, **zero** `style` attributes and **zero** `<style>` blocks. So the strictest directive in the policy costs nothing.

**`style-src`'s `'unsafe-inline'` is load-bearing and cannot be dropped.** The app uses **nine** inline `style={{...}}` props. Seven are cosmetic and could move to classes, but two cannot: `components/ui/Select.tsx:316` positions the portalled menu from measured coordinates, and `modules/dashboards/components/BarList.tsx:17` sets each bar's width from its share of the maximum. A nonce does not help here, because CSP governs inline **style attributes** through `style-src-attr`, which needs `'unsafe-inline'` or `'unsafe-hashes'` rather than a nonce, and setting a custom property through `element.style.setProperty` is still a style attribute. So this stays, and the reason is written down so nobody tightens it and breaks the select menu and every dashboard bar at once.

## X11: what "builds on push" would actually do, so the decision is one read

**This is Klent's to answer and nothing here changes it.** What follows is the mechanism, because the question is easy to answer wrongly by analogy with the Actions workflow.

**The two mechanisms are independent.** `.github/workflows/ci.yml` is still committed and still declares `on: push: branches: [main, develop]`; it is disabled at the GitHub repository level rather than in the file, which is why five commits reached `develop` today without it running. A host's git integration is a separate subscription to the same pushes. Enabling one does not enable the other, and enabling both means every push runs the gate on GitHub **and** a build on the host.

**What a push-triggered build would run.** Cloudflare Pages would run the configured build command, `npm run build --workspace=app`, and `app/package.json`'s `build` is `tsc --noEmit && vite build`. So a host build type-checks and builds, and **that is all**. It does not run ESLint, the **ten** guard scripts, the **265** vitest tests, the **179** browser tests or `validate.sql`, because none of those is in `buildCommand`. The whole gate is 22 checks and a host build runs two of them. A green deploy therefore means "it compiled", not "it passed".

**The trade-off, stated once.** Against: a build on every push publishes whatever is on the branch, and this branch takes work-in-progress commits. In favour: preview deployments per branch are the only practical way to look at a change on a real origin, and they are what make X4's redirect-URL question worth solving.

**My recommendation, which is not a decision.** Build production from `main` only, and never from `develop`, which takes work-in-progress commits. With one environment there are no preview origins to gain, so the alternative costs little: `wrangler pages deploy` by hand is one command.

## X10: five checks, each proving a different item

Run these after deploying, not before, and treat a green result as evidence that the configuration took rather than that the page loaded.

| Check | What it proves |
| :---- | :---- |
| Google sign-in completes | X3's OAuth restriction and X4's redirect URLs |
| One dashboard widget renders numbers | `dash` is exposed, so X3 took |
| A deep link such as `/recruit/candidates/<id>` loads on a cold visit | the SPA rewrite, so X7's host config took |
| A row changes and the list updates without a refresh | `wss://` passes the CSP |
| The public careers page lists a role | `careers-page` deployed with `verify_jwt=false` and `CAREERS_PUBLIC_ORIGIN` set. It proves that one function, not all six; `scripts/check-cutover.mjs` probes the other ten |

The careers check has a known correct-but-surprising outcome: **every seeded requisition is `is_test`, so a seed-only instance shows zero roles**. That is the right answer, not a failure. Locally, 3 of 690 requisitions carry `is_test`, and the live careers listing filters them out.

**Three of the five can be automated and are**, by `scripts/check-cutover.mjs`: the dashboard query, the deep link and the careers page. The two that cannot are Google sign-in, which needs a real Google account and a browser, and the live update, which needs a second session watching. Do those two by hand and do not mark them done from the script's output.

## What is Klent's, and is not decided here

- **X1**, create the develop project and hand over the ref.
- **X8**, what data the hosted instance carries. The **73,022** imported candidate records are real people. Seed data only is a legitimate answer, and no real data goes up on my judgement.
- **X11**, whether the host's git integration builds on push. The GitHub Actions workflow is disabled at Klent's instruction and stays disabled; a host building on push is a separate mechanism and needs its own yes or no. The X11 section above sets out what such a build would and would not run, and carries a recommendation rather than a decision.

## X8's numbers, measured rather than quoted

What a cutover would actually carry, from the local stack on 2026-09-07:

| Table | Rows | of which `is_test` |
| :---- | ----: | ----: |
| `people` | **72,988** | 10 |
| `candidate_profiles` | 72,917 | n/a |
| `applications` | 86,133 | n/a |
| `activities` | **213,929** | n/a |
| `companies` | 195 | 5 |
| `requisitions` | 690 | 3 |
| `deals` | 2 | 2 |
| `attachments` | 1,738 | n/a |
| `staff` | 12 | no `is_test` column |

The 72,988 people are the decision. Everything else is small: 195 companies and 690 requisitions are not a privacy question, and `deals` is entirely demo data.

`activities` read 213,744 when this table was first written and 213,929 an hour later, because the gate runs write rows. It is the one figure here that moves on its own; re-read it rather than quoting it. Every other row was re-measured on 2026-09-07 and was unchanged. `applications` has no `is_test` column, which is why its cell says `n/a` rather than 0.

## X9: the purge, if real data goes up

Order matters because of the foreign keys: `people`, `requisitions`, `deals`, `companies`, with the statements in `README.md`. `staff` has no `is_test` column, so the three demo staff (Rita, Sam and Ben) are deleted by hand. Locally that is currently 10 test people, 5 test companies, 3 test requisitions and 2 test deals.

**The purge order was checked for coverage rather than taken on trust.** Every base table in `public` that carries an `is_test` column is one of the four:

```
select c.relname, c.relkind from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join information_schema.columns col
    on col.table_name = c.relname and col.table_schema = 'public'
 where n.nspname = 'public' and col.column_name = 'is_test';

companies|r   deals|r   people|r   requisitions|r
company_list|v   contact_list|v   deal_list|v
```

The other three hits are views over those tables (`relkind` `v`), so they carry no rows of their own. Nothing with an `is_test` column is missing from the purge, and nothing in the purge lacks the column.

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

`_headers` and `_redirects` are in `app/public/`, so `vite build` emits them into `app/dist/` with the rest of the output. **Corrected 2026-09-09:** they used to sit in `docs/07-environments/cloudflare/` and were never wired to the build, which meant the port existed on paper only. That directory is deleted. `_headers` was generated from `vercel.json`'s own JSON, and `vercel.json` is now deleted, so `app/public/_headers` is the only copy of the header set and the CSP.

**`_redirects` was wrong on 2026-09-07 and is now deliberately empty of rules.** The first version carried the obvious port, `/* /index.html 200`, and this section claimed "Cloudflare Pages serves an existing static file before consulting `_redirects`, so the exclusion is unnecessary". Cloudflare's own documentation says the opposite:

> Redirects are always followed, regardless of whether or not an asset matches the incoming request.
>
> `developers.cloudflare.com/pages/configuration/redirects/`, read 2026-09-07

**The difference is platform behaviour, not syntax.** Vercel checks the filesystem before it applies a rewrite, which its Build Output API documents as routing phases: `handle: 'filesystem'` is annotated `check matches after the filesystem misses`, and `handle: 'rewrite'` is a later phase still, so a `vercel.json` rewrite never sees a request an existing file answers. Cloudflare has no such step in front of `_redirects`. So `vercel.json`'s `/((?!assets/).*)` lookahead is belt and braces on Vercel, and on Cloudflare there is nothing behind it: `/*` would have proxied every request for `/assets/index-<hash>.js` to `index.html`, and the app would have served HTML where the browser expected JavaScript. `_redirects` has no negative lookahead to copy the exclusion with either; it supports splats and placeholders only.

The claim was not merely imprecise, it asserted Vercel's behaviour of a platform that documents the opposite.

**No rule is needed, because Pages already does this and does it correctly:**

> If your project does not include a top-level `404.html` file, Pages assumes that you are deploying a single-page application. This includes frameworks like React, Vue, and Angular. Pages' default single-page application behavior matches all incoming paths to the root (`/`), allowing you to capture URLs like `/about` or `/help` and respond to them from within your SPA.
>
> `developers.cloudflare.com/pages/configuration/serving-pages/`, read 2026-09-07

The build satisfies the precondition: `find app/dist -maxdepth 1 -name '*.html'` returns `index.html` and nothing else, and there is no `404.html` anywhere in the output. `_redirects` therefore holds only comments, which Cloudflare supports (`Lines starting with a # will be treated as comments`), and those comments say why the catch-all must not be added back.

**Two more differences the port had to handle, both from the headers documentation:**

- **Pages adds `Access-Control-Allow-Origin: *` to every static asset response by default and Vercel does not.** A straight port would have quietly widened CORS across the whole origin. `_headers` detaches it with `! Access-Control-Allow-Origin`, using the documented detach syntax. `Referrer-Policy` is the same shape with a smaller consequence: Pages defaults to `strict-origin-when-cross-origin` and the rule replaces it with `no-referrer`.
- **A deep link's response does not match the `/index.html` rule.** The SPA fallback answers `/recruit/candidates/<id>` from `index.html` without changing the URL, so `Cache-Control: no-cache` does not apply to it; it gets Cloudflare's default `public, max-age=0, must-revalidate`, which has the same effect. A `/` rule was added for the root. Stated rather than left to be discovered.

Against the documented limits: `_headers` uses **4 rules of the 100 allowed** with a longest line of **500 characters of the 2,000 allowed**; `_redirects` uses **0 of 2,100**.

**The honest summary of this section: the Cloudflare configuration is verified against Cloudflare's own documentation and has never been deployed.** It has not served a request. The Vercel references that remain below are historical, kept only because they explain why the port had to differ.

## What this runbook does not answer, stated rather than left implied

- **Whether the hosted instance works.** Nothing here has served a request from a hosted origin, because X1 has not happened. Every figure is from the repository or the local stack, and every check is written to skip rather than pass when it cannot reach a target. The one exception is recorded honestly rather than buried: `scripts/check-cutover.mjs` reached the live project's API on its first run, read-only, which is QA-017.
- ~~**The build's exact output.**~~ **Measured 2026-09-07, re-measured 2026-09-08 after the `dist` rename, and the plan's original figure was wrong.** The total moved from 955,095 to **955,154 bytes** across the rename, 59 bytes, because the entry chunk's content hash changed with the W25 stylesheet edit and the filename length with it. The file count and the largest asset did not move. It recorded "41 files at 1.0 MB with the largest at 212 KB". A fresh `npm run build --workspace=app` writes **34 files** totalling **955,154 bytes** (0.91 MiB, 0.96 MB), largest `assets/vendor-supabase-wIXNjVJv.js` at **215,735 bytes**, in 990ms. Twenty-nine files are in `assets/`; the other five are `index.html`, `favicon.png`, `apple-touch-icon.png`, `og-careers.png` and `ventvest-logo.webp`. Re-measure with `find app/dist -type f | wc -l` and `find app/dist -type f -exec stat -f%z {} + | awk '{s+=$1} END{print s}'`. Fewer files and fewer bytes than claimed, so nothing about either host's limits changes.
- **Whether the host's git integration should build on push.** X11, and Klent's. The X11 section sets out the mechanism and carries a recommendation; the answer is still his.
- **Whether Cloudflare's `_headers` and `_redirects` behave as documented.** They are verified against Cloudflare's own pages, with dates, and against the documented limits. Neither file has served a request. The one thing that would have been caught only by deploying was caught by reading instead, which is QA-018, and that is luck as much as method.
- **Whether the 12 Edge Functions deploy.** Their `verify_jwt` settings and secrets are verified against `config.toml` and every reachable `Deno.env.get`, and all of them answer `OPTIONS` on the local stack. `supabase functions deploy` has not been run against any project from this checkout.
- **Anything about performance or cost under real traffic.** No load figures, no bandwidth estimate, no Supabase compute sizing. The free-tier headroom table is about static-asset limits, not about the database.
- **What `supabase migration list --linked` says today.** The last reading, on 2026-09-01, showed an empty remote for the ten `20260901*` migrations that existed then. `CLAUDE.md` said "eight" until 2026-09-07 and that was wrong; there are ten of those files, and thirty-six dated 2026-09-01 or later. The command talks to the live project, and this session's standing instruction is that everything happens on the local stack, so it was not re-run: read it yourself before the first deploy.
