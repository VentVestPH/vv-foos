# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this checkout is

VentVest Front Office OS (FOOS): ATS + CRM on Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) with React 18 + Vite + TypeScript on top.

This particular tree is **`foos_redesign_2`**, the Taleo-exact UI replica frontend, and as of 2026-09-02 it is **the only frontend anyone should change**. It runs on port **5175** (`strictPort: true`, so it fails loudly rather than drifting to another port) against the live Supabase project (`mebfbbvrqdctamnzvbbs`). Build output goes to `dist-redesign-2/` with `emptyOutDir: true`.

Two sibling frontends used to share this schema: `/foos` on port 5173 and `/foos_redesign` on 5174. Both are **archived, not deleted** (plan item F4). Neither is present on this machine, so nothing here depends on them, and every schema change or `database.types.ts` edit now costs one frontend instead of three. Do not port changes into them, do not reinstate them, and do not treat their absence as a bug. Deletion waits on confirmation that nobody demos from them.

This tree is a git repository on branch `develop`, with `origin/main` and `origin/develop`. History is available and worth consulting; the docs in `docs/03-plan/` point at commits for superseded status notes.

## Commands

Root is an npm workspace host (`app`, `tests`). Install once at the root; dependencies hoist to `./node_modules`.

```sh
npm install

# Frontend (app/)
npm run dev --workspace=app          # Vite on http://localhost:5175
npm run typecheck --workspace=app    # tsc --noEmit
npm run lint --workspace=app         # eslint, flat config in app/eslint.config.js
npm run build --workspace=app        # typecheck + vite build

# Database (root scripts, need supabase CLI + $DATABASE_URL)
npm run db:push                      # BLOCKED by a guard: this checkout is linked to the LIVE project
npm run db:reset                     # migrations + seed, local
npm run db:validate                  # supabase/tests/validate.sql

# Tests (tests/)
npm test                             # Vitest API/RLS tests
npm run test:e2e                     # Playwright browser flows
npm run e2e:install --workspace=tests    # one-time Chromium download
```

Single test:

```sh
npm run test --workspace=tests -- api/rls-boundary.test.ts
npm run test --workspace=tests -- -t "sourcer cannot read"
npx playwright test e2e/crm-deals.spec.ts     # from tests/
```

Two static gates: `npm run lint --workspace=app` (ESLint 9 flat config at `app/eslint.config.js`, with `typescript-eslint` and `eslint-plugin-react-hooks`) and `npm run typecheck --workspace=app`. There is no Prettier config. `strict`, `noUnusedLocals` and `noUnusedParameters` are all on, so unused imports break the build.

`.github/workflows/ci.yml` runs both plus the build and four guard scripts (`check-contrast`, `check-motion`, `check-comments`, `check-migrations`) on every push to `main` and `develop`.

**No comments in source.** `.ts`, `.tsx`, `.js`, `.mjs` and `.css` files carry no comments; `scripts/check-comments.mjs` guards against reintroducing low-value ones. Rationale belongs in `docs/` or a commit message. SQL migrations are the one exception: their header comments are the only record of why a schema decision was made.

Local schema validation runs on plain Postgres 14+, no Supabase needed (see README.md "Local validation"). `supabase/tests/local_shim.sql` stubs `auth.uid()` and the anon/authenticated/service_role roles; never run it against the hosted project.

## Test-suite caveats

- `tests/vitest.config.ts` includes `api/**/*.test.ts` and `mocks/**/*.test.ts`, and runs files serially. `mocks/gmail-calendar-mocked.test.ts` throws at import time unless `FOOS_INTAKE_PARSER_SECRET` in `tests/.env` matches `INTAKE_EMAIL_PARSER_SECRET` in `supabase/functions/.env`. Both files are gitignored, so a fresh clone must set them.
- The Vitest tests sign in as real per-role personas against whatever `tests/.env` points at. Point it at the local stack (`FOOS_SUPABASE_URL=http://127.0.0.1:55321`), not the hosted project. Personas come from `tests/fixtures/personas.sql` and are seeded by `npm run db:reset`.
- `tests/playwright.config.ts` defaults to port 5175, two workers, and starts the dev server itself. Override with `FOOS_PORT`, `FOOS_BASE_URL`, `FOOS_PW_WORKERS`, or `FOOS_SKIP_WEBSERVER=1` to run against a server that is already up.
- `tests/sql/pgtap_suite.sql` is run manually through the Supabase SQL editor, not by any npm script.
- `tests/DEFECT_LOG.md`, `RETEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, `EVENT_PIPELINE.md` and `PURGE_VERIFICATION.md` carry the QA state of the project. Check `DEFECT_LOG.md` before assuming a failure is new.

## Architecture

### Security lives in the database

RLS is enabled on every table, deny-by-default. Role comes from `staff.role` looked up via `auth.uid()` by `get_my_role()` (security definer), never from a client parameter. Route guards in `App.tsx` and role filters in `navConfig.ts` are UI courtesy only; adding a role to a guard grants nothing that Postgres does not already allow, and removing one hides nothing that RLS still exposes.

`staff.id` must equal the matching `auth.users.id`. There is no hard FK (so migrations stay runnable on plain Postgres); the signup hook owns that invariant.

### Triggers own the derived writes

Stage and status changes are plain `UPDATE`s on `applications`, `requisitions`, `candidate_profiles`, `deals`, `tickets`. Migration 10's triggers then write the `status_change` row in `activities`, the `audit_log` row, and the `events_outbox` event, and maintain `stage_changed_at` / `hired_at`. **Never write `activities` status_change rows, `audit_log`, or `events_outbox` from application code.**

`display_code` (`REQ-`, `APP-`, `DEAL-`, `TKT-`) is issued by a Postgres sequence. Leave it out of every insert.

Zoho exports come in two dialects and `parseZohoTimestamp` handles both: Recruit writes `MM/DD/YYYY hh:mm AM/PM`, CRM writes `YYYY-MM-DD HH:MM:SS`. `Initial Date` has no year and three shapes (`M/DD`, `DD-Mon`, `Mon-DD`); `parsePartialDate` borrows the year from the row's own `Created Time`. An imported attachment path starts with `zoho-import/pending/` until its bytes arrive, and `lib/attachments.ts` is what the UI uses to tell that apart from a real file.

`events_outbox` rows are `(event_name, aggregate_id, payload, created_at, processed_at)`, with null `processed_at` meaning pending. Edge Functions consume them with the service role; the frontend subscribes to them via Realtime (`HiredPromotionListener.tsx` is the canonical example). `tests/EVENT_PIPELINE.md` maps all 10 events to their consuming UI effect.

### Migrations and generated types

`supabase/migrations/*.sql` apply lexically, one concern per file; README.md tabulates 01 through 12, and `20260725*` adds careers, intake import, the Agent 6 Vault helpers, and the `dash` schema. New migrations sort after those.

`app/src/lib/database.types.ts` is **hand-derived** from the migrations, not generated. It holds all 24 tables (Row/Insert/Update), the 12 enums, the locked stage-order arrays (`REQUISITION_STATUSES`, `APPLICATION_STAGES`, `DEAL_STAGES`, `TICKET_STATUSES`) and the jsonb shapes for `people.emails/phones/education`. If a migration changes a table, change this file in the same edit. Stage sets are locked: do not reorder or extend them.

### The Supabase client

One client, `lib/supabase.ts`, imported directly everywhere. `database.types.ts` carries `Relationships: []` on all 25 tables, which is what postgrest-js needs to keep Insert and Update payloads from collapsing to `never`.

Four module-local `db.ts` shims used to work around that missing field. They were reduced to one-line re-exports once the types were fixed, and were deleted on 2026-09-02. `modules/dashboards/db.ts` survives for one reason only: it exports `dashDb`, the same client scoped to the `dash` Postgres schema. Use `dashDb` for `dash` views and `supabase` for everything else.

### Frontend structure

`app/src/App.tsx` is the whole route map. Everything below `/` renders inside `AppShell` behind `RequireAuth`; each module mount is additionally wrapped in `RequireAuth roles={[...]}`.

| Mount | Module | Roles |
|---|---|---|
| `/` | `pages/DashboardPage.tsx` → `modules/dashboards` | all |
| `/recruit/*` | `modules/recruit` (ATS) | admin, recruiter, sourcer |
| `/sales/*` | `modules/sales` (CRM) | admin, recruiter, bd |
| `/intake/*` | `modules/intake` | all four (deliberately cross-module) |
| `/settings/*` | `modules/settings` | all four |
| `/employees`, `/onboard`, `/users`, `/courses` | `pages/TaleoModulePlaceholderPage.tsx` | all / admin for Users |

Each module is self-contained and all five now have the same shape: `index.tsx` exports its `<Routes>` tree plus its nav items, alongside `hooks.ts` (data access and React hooks), `lib.ts` (row types and pure helpers), `<module>.css`, and **its own `README.md`**. Only `dashboards` also has a `db.ts`, for `dashDb`. ESLint forbids a module importing another module, so anything genuinely shared belongs in `lib/`, `components/` or `shell/`. Those module READMEs are the authoritative per-module documentation (routes, query-param contracts for dashboard drill-through, data behavior, legal state transitions, Gate 3 demo scripts). Read the relevant one before changing a module. `app/README-APP.md` documents the shared shell, auth, and the `components/ui/` inventory.

### The Taleo replica shell

`shell/AppShell.tsx` composes `TaleoUtilityHeader` + `TaleoPrimaryNav` + `TaleoSidebar`. The primary nav order in `shell/navConfig.ts` is fixed by the redesign prompt (Taleo tab order with FOOS's Deals/Tickets/Intake slotted in at specified positions); Settings is intentionally not a tab.

Screenshot-accurate controls that have no real FOOS behavior yet must route through `shell/TaleoPlaceholder.tsx` (`usePlaceholder().show('Send To')` or `<TaleoPlaceholderAction label="Send To" />`), currently used in 18 files. Never substitute an `alert()`, a silent no-op handler, a fake success state, or a link to a nonexistent route.

### Styling

`styles/tokens.css` holds the design tokens verbatim from the architecture doc and is the only file that defines custom properties. Everything else lives in **cascade layers**, and `styles/app.css` is now nothing but the layer order: fourteen `@import './layers/<name>.css' layer(<name>)` lines followed by one `@layer` statement that also declares the five `module.*` layers. Layer order is `base, shell, auth, controls, tables, pages, panels, narrow, taleo, states, pagination, motion, widgets, print`, then the modules.

Two consequences worth knowing before editing CSS:

- **An unlayered rule beats every layered rule, whatever its specificity.** One stray rule outside a layer silently outranks the entire stylesheet. `node scripts/check-css-layers.mjs` fails the build on that, and on a layer file that is not imported or that declares its own layer.
- **Across layers, layer order decides and specificity does not.** A module rule now beats a shared rule even when the shared one is more specific, so the fix for a conflict is to move the rule to the right layer rather than to add a class to the selector.

`import './styles/app.css'` must stay the **first** import in `main.tsx`. It is not cosmetic: the intake module's stylesheet reaches the entry bundle through `useIntakeBadge` in `PrimaryNav`, and if it is emitted first then `module.intake` becomes the document's first-declared layer and the whole order inverts.

No CSS framework and no charting library (dashboard bars are hand-rolled CSS in `dashboards/components/BarList.tsx`). Use the token variables; never hard-code a color. Inter with Roboto fallback, 8px grid, 12px cell padding, max shadow `0 1px 2px rgba(0,0,0,.05)`.

### Edge Functions

`supabase/functions/` holds **eleven** functions: careers (`careers-page`, `careers-apply`, `careers-status`), intake (`intake-sheet-fetch`, `intake-sheet-commit`, `intake-email-parser`) and Google integration (`google-oauth-start`, `google-oauth-callback`, `google-sync`, `gmail-send`, `calendar-create-meeting`). `README.md` and `README-agent6.md` in that directory record each function's `verify_jwt` setting, deploy state, and secrets. Two rules learned the hard way there: any function a browser calls needs explicit `OPTIONS`/CORS handling, and `req.url`'s scheme cannot be trusted behind Supabase's proxy (`careers-page` hardcodes `https`, overridable via `CAREERS_PUBLIC_ORIGIN`).

Functions that write on a user's behalf run under the caller's own JWT where RLS should decide (`intake-sheet-commit`); service-role use is confined to the public careers surface and outbox consumers.

## Test suites and guards

Both suites run against the local stack from a clean `npm run db:reset` with no manual steps. They are order-independent and leave no rows, storage objects or queue entries behind; that was verified over eight consecutive loops, not one run.

```sh
npm run test --workspace=tests     # 64 API/RLS tests (vitest, files run serially)
npm run e2e  --workspace=tests     # 39 browser tests (playwright, 2 workers)
psql "$DB_URL" -f supabase/tests/validate.sql   # 34 schema checks
node scripts/check-attachment-queue.mjs         # no orphaned attachment files
```

Four things bite anyone adding tests here:

- **Fixtures must be run-unique.** Cleanup by a shared prefix means two specs delete each other's rows. Every spec derives its tag from `process.pid` plus a random suffix.
- **`datetime-local` inputs are local time.** Filling one from `toISOString()` puts the value hours out; on UTC+8 a "+1 hour" reminder lands in the past and the reminder sweep fires it. Use `localDateTimeValue()` from `tests/e2e/helpers.ts`.
- **Playwright is capped at 2 workers** because the local Realtime container has a messages-per-second limit and every page subscribes. Symptom is `docker logs supabase_realtime_* | grep MessagePerSecondRateLimitReached` and live-update tests going stale.
- **Vitest runs files serially** (`fileParallelism: false`) because the 10 MB oversized-resume case saturates the edge runtime enough that concurrent Edge Function calls return 503.

Teardown belongs in `afterEach`/`afterAll`, never inline at the end of a test: a failing assertion aborts the rest of the block and the rows leak. Delete a storage object **before** its `attachments` row, or the file becomes unreachable (the DELETE policy matches on that row and `remove()` then returns an empty array with no error).

Four migration and repair tools, all of which refuse a non-local target unless `--allow-remote` is passed, and all of which dry-run by default:

```sh
node migration/import.mjs                              # dry run; --apply to write, --entity to narrow
node scripts/add-legacy-owners.mjs                     # inactive staff rows for Zoho owners with none
node scripts/backfill-zoho-candidate-fields.mjs        # repairs star_grade and initial_date from the export
node scripts/purge-zoho-import.mjs                     # reverses an import from zoho_id_map
node scripts/rotate-persona-passwords.mjs              # fresh random persona passwords, printed once
```

The importer resolves paths relative to the current directory, so **run it from the repository root**; from inside `migration/` it writes its report to `migration/migration/out/`, and those reports contain candidate data.

`npm run db:add-staff` creates a named local account so work happens under a real identity instead of a shared demo persona:

```sh
FOOS_NEW_STAFF_PASSWORD='pick-one' npm run db:add-staff -- you@ventvest.com "Your Name" admin
```

## Local versus production

**This checkout is linked to the live project.** `supabase/.temp/project-ref` holds `mebfbbvrqdctamnzvbbs`, so every `--linked` command targets production. There is no staging project.

Develop against the local stack: `supabase start`, then `npm run db:reset` (which also seeds the four test personas and restarts the edge runtime, since `db reset` otherwise leaves it holding stale connections to the storage container it just replaced and every upload fails with `StorageApiError 502`).

`npm run db:push` is deliberately gated behind `scripts/confirm-production-push.mjs` and exits 1. Two reasons: it writes to the live project, and the migration ledgers do not line up. Ten migrations were applied to production through the MCP connector on 2026-07-25 under generated timestamps, while the repo carries six hand-written files reconstructing the same objects under different names. `supabase db push` refuses on its own with `LegacyDbPushMissingLocalError`; do not "fix" that with `migration repair --status reverted` without reading the Deployment state section of `docs/07-environments/`.

**Corrected 2026-09-07.** This paragraph used to say "the eight `20260901*` migrations". Both halves of that were wrong by the time anyone read it: there are **ten** `20260901*` files, and **thirty-six** migrations dated 2026-09-01 or later (`ls supabase/migrations/ | awk '$0>="20260901"' | wc -l` returns 36 against a total of 54). They exist locally and in git only.

The only remote reading taken is the one from 2026-09-01, when `supabase migration list --linked` showed an empty `remote` for the ten files that existed then. That command talks to the live project, so it has deliberately not been re-run; re-read it yourself before the first deploy rather than trusting this line.

## Environment

| File | Variables |
|---|---|
| `.env` (root) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **Absent in this checkout as of 2026-09-07**, and because it is gitignored the absence is silent: `source .env` succeeds and sets nothing. Use `app/.env`'s `VITE_` pair or `tests/.env`'s `FOOS_` pair, or pass the URL explicitly |
| `app/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client throws at boot if either is missing) |
| `tests/.env` | `FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY`, `FOOS_QA_TEST_PASSWORD`, optional `FOOS_BASE_URL` |

## Things migrations cannot do

These are one-time Supabase Dashboard settings; a fresh project needs them again.

- Auth: Google OAuth restricted to the ventvest.com hosted domain, plus email/password fallback.
- `pg_cron` enabled, so migration 10 can schedule `foos-reminder-due` and the 15-minute `dash` materialized-view refreshes. Without it, call `public.fn_fire_due_reminders()` externally.
- Settings → Data API → Exposed schemas must include `dash`, or every dashboard query fails with `PGRST106` (defect QA-001).

## Demo and test data

Every demo row carries `is_test = true`. Seed data includes three demo staff (Rita/Sam/Ben, one per role) so RLS is demonstrable; `staff` has no `is_test` column, so those rows are deleted by hand before cutover. The purge order is `people`, `requisitions`, `deals`, `companies` (README.md has the statements). Because all seeded requisitions are `is_test`, the live careers listing correctly shows zero roles.
