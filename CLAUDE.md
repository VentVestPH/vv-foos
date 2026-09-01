# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this checkout is

VentVest Front Office OS (FOOS): ATS + CRM on Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) with React 18 + Vite + TypeScript on top.

This particular tree is **`foos_redesign_2`**, the Taleo-exact UI replica frontend. It is one of several interchangeable frontends against the *same* live Supabase project (`mebfbbvrqdctamnzvbbs`): `/foos` runs on port 5173, `/foos_redesign` on 5174, this one on **5175** (`strictPort: true`, so it fails loudly rather than drifting to another port). Build output goes to `dist-redesign-2/` with `emptyOutDir: false`.

There is no `.git` here. No branches, no diffs, no history to consult; treat the working tree as the only source of truth.

## Commands

Root is an npm workspace host (`app`, `tests`). Install once at the root; dependencies hoist to `./node_modules`.

```sh
npm install

# Frontend (app/)
npm run dev --workspace=app          # Vite on http://localhost:5175
npm run typecheck --workspace=app    # tsc --noEmit, the only static gate
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

There is no linter and no ESLint/Prettier config. `npm run typecheck --workspace=app` is the verification step for frontend changes; `strict`, `noUnusedLocals` and `noUnusedParameters` are all on, so unused imports break the build.

Local schema validation runs on plain Postgres 14+, no Supabase needed (see README.md "Local validation"). `supabase/tests/local_shim.sql` stubs `auth.uid()` and the anon/authenticated/service_role roles; never run it against the hosted project.

## Test-suite caveats

- `tests/vitest.config.ts` only picks up `api/**/*.test.ts`. `mocks/gmail-calendar-mocked.test.ts` is outside that glob and does not run by default.
- The Vitest tests sign in as real per-role personas over HTTPS against the **live** project. They need network access to `*.supabase.co` and a filled-in `tests/.env` (`FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY`, `FOOS_QA_TEST_PASSWORD`); personas come from `tests/fixtures/personas.sql`.
- `tests/playwright.config.ts` still targets `http://localhost:5173` and starts `npm run dev --workspace=app -- --port=5173`, which contradicts this frontend's `strictPort: 5175`. Run e2e here with `FOOS_BASE_URL=http://localhost:5175 FOOS_SKIP_WEBSERVER=1` against an already-running dev server, or fix the config.
- `tests/sql/pgtap_suite.sql` is run manually through the Supabase SQL editor, not by any npm script.
- `tests/DEFECT_LOG.md`, `RETEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, `EVENT_PIPELINE.md` and `PURGE_VERIFICATION.md` carry the QA state of the project. Check `DEFECT_LOG.md` before assuming a failure is new.

## Architecture

### Security lives in the database

RLS is enabled on every table, deny-by-default. Role comes from `staff.role` looked up via `auth.uid()` by `get_my_role()` (security definer), never from a client parameter. Route guards in `App.tsx` and role filters in `navConfig.ts` are UI courtesy only; adding a role to a guard grants nothing that Postgres does not already allow, and removing one hides nothing that RLS still exposes.

`staff.id` must equal the matching `auth.users.id`. There is no hard FK (so migrations stay runnable on plain Postgres); the signup hook owns that invariant.

### Triggers own the derived writes

Stage and status changes are plain `UPDATE`s on `applications`, `requisitions`, `candidate_profiles`, `deals`, `tickets`. Migration 10's triggers then write the `status_change` row in `activities`, the `audit_log` row, and the `events_outbox` event, and maintain `stage_changed_at` / `hired_at`. **Never write `activities` status_change rows, `audit_log`, or `events_outbox` from application code.**

`display_code` (`REQ-`, `APP-`, `DEAL-`, `TKT-`) is issued by a Postgres sequence. Leave it out of every insert.

`events_outbox` rows are `(event_name, aggregate_id, payload, created_at, processed_at)`, with null `processed_at` meaning pending. Edge Functions consume them with the service role; the frontend subscribes to them via Realtime (`HiredPromotionListener.tsx` is the canonical example). `tests/EVENT_PIPELINE.md` maps all 10 events to their consuming UI effect.

### Migrations and generated types

`supabase/migrations/*.sql` apply lexically, one concern per file; README.md tabulates 01 through 12, and `20260725*` adds careers, intake import, the Agent 6 Vault helpers, and the `dash` schema. New migrations sort after those.

`app/src/lib/database.types.ts` is **hand-derived** from the migrations, not generated. It holds all 24 tables (Row/Insert/Update), the 12 enums, the locked stage-order arrays (`REQUISITION_STATUSES`, `APPLICATION_STAGES`, `DEAL_STAGES`, `TICKET_STATUSES`) and the jsonb shapes for `people.emails/phones/education`. If a migration changes a table, change this file in the same edit. Stage sets are locked: do not reorder or extend them.

### The `Relationships` shim (a live wart)

`database.types.ts` predates postgrest-js's requirement that every table type carry a `Relationships` array, and the installed supabase-js floats to 2.110 from `^2.45`. Without `Relationships`, the typed client collapses Insert/Update payloads to `never`. Four modules each work around this with a local `db.ts` that maps `Relationships: []` over the shared tables: `modules/sales/db.ts`, `modules/intake/db.ts`, `modules/settings/db.ts`, `modules/dashboards/db.ts`. The fix is to add `Relationships: []` to each table in `database.types.ts` and delete all four shims; until then, new module code should import `db` from its module's shim rather than `supabase` from `lib/supabase.ts` when it writes.

`modules/dashboards/db.ts` also exports `dashDb`, the same client scoped to the `dash` Postgres schema.

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

Each module is self-contained: `index.tsx` exports its `<Routes>` tree plus its nav items, alongside `db.ts`, `hooks.ts`, `lib.ts`, `<module>.css`, and **its own `README.md`**. Those module READMEs are the authoritative per-module documentation (routes, query-param contracts for dashboard drill-through, data behavior, legal state transitions, Gate 3 demo scripts). Read the relevant one before changing a module. `app/README-APP.md` documents the shared shell, auth, and the `components/ui/` inventory.

### The Taleo replica shell

`shell/AppShell.tsx` composes `TaleoUtilityHeader` + `TaleoPrimaryNav` + `TaleoSidebar`. The primary nav order in `shell/navConfig.ts` is fixed by the redesign prompt (Taleo tab order with FOOS's Deals/Tickets/Intake slotted in at specified positions); Settings is intentionally not a tab.

Screenshot-accurate controls that have no real FOOS behavior yet must route through `shell/TaleoPlaceholder.tsx` (`usePlaceholder().show('Send To')` or `<TaleoPlaceholderAction label="Send To" />`), currently used in 18 files. Never substitute an `alert()`, a silent no-op handler, a fake success state, or a link to a nonexistent route.

### Styling

`styles/tokens.css` holds the design tokens verbatim from the architecture doc; `styles/app.css` is the single stylesheet, no CSS framework, no charting library (dashboard bars are hand-rolled CSS in `dashboards/components/BarList.tsx`). Use the token variables; never hard-code a color. Inter with Roboto fallback, 8px grid, 12px cell padding, max shadow `0 1px 2px rgba(0,0,0,.05)`.

### Edge Functions

`supabase/functions/` holds careers (`careers-page`, `careers-apply`), intake (`intake-sheet-fetch`, `intake-sheet-commit`, `intake-email-parser`) and Google integration (`google-oauth-start`, `google-oauth-callback`, `google-sync`, `gmail-send`, `calendar-create-meeting`). `README.md` and `README-agent6.md` in that directory record each function's `verify_jwt` setting, deploy state, and secrets. Two rules learned the hard way there: any function a browser calls needs explicit `OPTIONS`/CORS handling, and `req.url`'s scheme cannot be trusted behind Supabase's proxy (`careers-page` hardcodes `https`, overridable via `CAREERS_PUBLIC_ORIGIN`).

Functions that write on a user's behalf run under the caller's own JWT where RLS should decide (`intake-sheet-commit`); service-role use is confined to the public careers surface and outbox consumers.

## Test suites and guards

Both suites run against the local stack from a clean `npm run db:reset` with no manual steps. They are order-independent and leave no rows, storage objects or queue entries behind; that was verified over eight consecutive loops, not one run.

```sh
npm run test --workspace=tests     # 64 API/RLS tests (vitest, files run serially)
npm run e2e  --workspace=tests     # 39 browser tests (playwright, 2 workers)
psql "$DB_URL" -f supabase/tests/validate.sql   # 18 schema checks
node scripts/check-attachment-queue.mjs         # no orphaned attachment files
```

Four things bite anyone adding tests here:

- **Fixtures must be run-unique.** Cleanup by a shared prefix means two specs delete each other's rows. Every spec derives its tag from `process.pid` plus a random suffix.
- **`datetime-local` inputs are local time.** Filling one from `toISOString()` puts the value hours out; on UTC+8 a "+1 hour" reminder lands in the past and the reminder sweep fires it. Use `localDateTimeValue()` from `tests/e2e/helpers.ts`.
- **Playwright is capped at 2 workers** because the local Realtime container has a messages-per-second limit and every page subscribes. Symptom is `docker logs supabase_realtime_* | grep MessagePerSecondRateLimitReached` and live-update tests going stale.
- **Vitest runs files serially** (`fileParallelism: false`) because the 10 MB oversized-resume case saturates the edge runtime enough that concurrent Edge Function calls return 503.

Teardown belongs in `afterEach`/`afterAll`, never inline at the end of a test: a failing assertion aborts the rest of the block and the rows leak. Delete a storage object **before** its `attachments` row, or the file becomes unreachable (the DELETE policy matches on that row and `remove()` then returns an empty array with no error).

`npm run db:add-staff` creates a named local account so work happens under a real identity instead of a shared demo persona:

```sh
FOOS_NEW_STAFF_PASSWORD='pick-one' npm run db:add-staff -- you@ventvest.com "Your Name" admin
```

## Local versus production

**This checkout is linked to the live project.** `supabase/.temp/project-ref` holds `mebfbbvrqdctamnzvbbs`, so every `--linked` command targets production. There is no staging project.

Develop against the local stack: `supabase start`, then `npm run db:reset` (which also seeds the four test personas and restarts the edge runtime, since `db reset` otherwise leaves it holding stale connections to the storage container it just replaced and every upload fails with `StorageApiError 502`).

`npm run db:push` is deliberately gated behind `scripts/confirm-production-push.mjs` and exits 1. Two reasons: it writes to the live project, and the migration ledgers do not line up. Ten migrations were applied to production through the MCP connector on 2026-07-25 under generated timestamps, while the repo carries six hand-written files reconstructing the same objects under different names. `supabase db push` refuses on its own with `LegacyDbPushMissingLocalError`; do not "fix" that with `migration repair --status reverted` without reading the Deployment state section of `docs/07-environments/`.

As of 2026-09-01, the eight `20260901*` migrations and the Edge Function changes exist locally and in git only. Verified with `supabase migration list --linked`: all eight report an empty `remote`.

## Environment

| File | Variables |
|---|---|
| `.env` (root) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| `app/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client throws at boot if either is missing) |
| `tests/.env` | `FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY`, `FOOS_QA_TEST_PASSWORD`, optional `FOOS_BASE_URL` |

## Things migrations cannot do

These are one-time Supabase Dashboard settings; a fresh project needs them again.

- Auth: Google OAuth restricted to the ventvest.com hosted domain, plus email/password fallback.
- `pg_cron` enabled, so migration 10 can schedule `foos-reminder-due` and the 15-minute `dash` materialized-view refreshes. Without it, call `public.fn_fire_due_reminders()` externally.
- Settings → Data API → Exposed schemas must include `dash`, or every dashboard query fails with `PGRST106` (defect QA-001).

## Demo and test data

Every demo row carries `is_test = true`. Seed data includes three demo staff (Rita/Sam/Ben, one per role) so RLS is demonstrable; `staff` has no `is_test` column, so those rows are deleted by hand before cutover. The purge order is `people`, `requisitions`, `deals`, `companies` (README.md has the statements). Because all seeded requisitions are `is_test`, the live careers listing correctly shows zero roles.
