# Tests

One workspace, three layers, sorted by what a test needs in order to run. The layer decides the folder, the tool and the command.

| Layer | Folder | Tool | Needs | Command |
| :---- | :---- | :---- | :---- | :---- |
| Unit | `unit/` | Vitest, project `unit` | nothing: no network, no database, no browser | `npm run test:unit` |
| Integration | `integration/` | Vitest, project `integration` | the local Supabase stack | `npm run test:integration` |
| Browser | `e2e/<area>/` | Playwright | the local stack and the dev server on 5175 | `npm run test:e2e` |

The commands in the table run from the repository root. To narrow a run, address the workspace and pass a path or `-t "name"` after `--`: `npm run e2e --workspace=tests -- e2e/recruit`, `npm run test:integration --workspace=tests -- integration/api/rls-boundary.test.ts`.

## Layout

```
tests/
  config/        vitest.workspace.ts, playwright.config.ts, playwright.audit.config.ts
  support/       shared code and data used by more than one layer
    env.ts         persona clients, settings cleanup, the local-target guard
    e2e-helpers.ts sign-in, option pickers, list search, waits that assert a condition
    routes.ts      the route table shared by e2e and audit
    fixtures/      personas.sql, seed-ids.ts, zoho-application-statuses.txt
    setup.ts       Vitest setup for the integration project
  unit/          pure logic: mappers, parsers, formatters, validators
  integration/
    api/           RLS boundaries, triggers, RPCs, Storage and Edge Functions through PostgREST
    mocked/        the one Edge Function boundary that can be mocked
  e2e/           browser flows, one folder per product area (below)
  audit/         exploratory harness: slow sweeps whose output a person reads. Not in the gate
  sql/           pgTAP suite, run by hand in the SQL editor
  tooling/       tests for the repository's own scripts (Node test runner)
  perf/          Core Web Vitals measurement
  qa/            defect log, retest matrix, regression checklist and manual smoke notes
```

### Browser areas

| Folder | Covers |
| :---- | :---- |
| `shell/` | app chrome: navigation, dialogs, menus, keyboard, accessibility, responsive, print, error boundaries, view settings, the select control |
| `lists/` | behaviour shared by list pages: search, sorting, paging, bulk actions, saved views, persistence |
| `records/` | behaviour shared by record pages: action bar, writes, empty states, timeline |
| `boards/` | Kanban boards: drag and keyboard moves |
| `dashboard/` | My View, Pipeline and Reports, the task board, reminders |
| `recruit/` | requisitions, candidates, the application pipeline, careers, merge and erase |
| `sales/` | accounts, deals, tickets |
| `intake/` | the intake queue, sheet and CSV import |
| `realtime/` | channel budget and live updates |
| `settings/` | settings pages, email templates, export |
| `workforce/` | employees, onboarding, courses |

A new spec goes in the folder whose product area it exercises. If it fits none, add a folder here and a row above.

## Where a new test goes

1. Pure function, no I/O: `unit/`. It runs in under a second with no setup, so prefer it.
2. Needs the database, an RPC, RLS or an Edge Function but no UI: `integration/api/`.
3. Needs a rendered page: `e2e/<area>/`. Assert the user-visible outcome, and check the persisted row when the behaviour is a write.
4. Exploratory measurement that nobody asserts on: `audit/`.

Move a check down a layer whenever it can be asserted there. A browser test that only checks arithmetic belongs in `unit/`.

## Conventions

- **Fixtures are run-unique.** Derive a tag from `process.pid` plus a random suffix, create what the test needs in `beforeAll` or the test, and remove it in `afterEach` or `afterAll`. Never assume a row the test did not create: CI runs against the seed only, while a developer's database holds the Zoho copy.
- **Shared persona state is shared.** Every worker signed in as one persona reads and writes the same `integration_settings` rows. Assert only what the test itself created, and delete settings with `deleteOwnSettings` from `support/env.ts`, which scopes the delete to the signed-in staff id.
- **Locators and waits.** Role and label locators, web-first assertions, no fixed sleeps, and no `.click().catch(() => undefined)`. Assert the condition instead of waiting longer. `optionNames`, `chooseOption` and `searchList` in `support/e2e-helpers.ts` are the patterns to copy.
- **One behaviour per test**, named for the behaviour. A UI change and the spec that asserts the old UI change in the same edit.
- **Serial describes** (`test.describe.configure({ mode: 'serial' })`) when tests in one block share a fixture. Workers otherwise run them concurrently and one worker's cleanup removes the other's rows.
- **The local-target guard.** `support/localTarget.ts` refuses a non-local Supabase URL. Never point these suites at the hosted project.

## Running everything

`npm run gate` is the verification entry point and `scripts/gate.sh` holds the stages.

| Command | Runs | Needs the stack |
| :---- | :---- | :---- |
| `npm run gate:quick` | static checks, all guard scripts, dead-code check, unit tests, in parallel | no |
| `npm run gate` | quick, then build and integration tests, the browser suite, then the database checks | yes |
| `npm run gate:data` | importer dry run and backfill against the Zoho export | yes |

The browser suite does not stop at the first failure inside the gate, so one run lists every failing test. Locally, the browser run stops at the first failure (`FOOS_PW_MAX_FAILURES=0` lifts that). `FOOS_PW_WORKERS`, `FOOS_BASE_URL`, `FOOS_PORT` and `FOOS_SKIP_WEBSERVER=1` tune the browser run.

## Artifacts

Everything generated goes under `.artifacts/` at the repository root, which git ignores: Playwright output and traces in `.artifacts/playwright/`, gate logs and the browser JSON report in `.artifacts/gate/`, audit captures in `.artifacts/audit/`. Delete the folder to clear it.

## Environment

`tests/.env` (copy `tests/.env.example`) holds `FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY` and `FOOS_QA_TEST_PASSWORD`. The suites sign in as the four seeded personas, one per role, which `npm run db:reset` creates from `support/fixtures/personas.sql`. `integration/mocked/gmail-calendar-mocked.test.ts` also needs `FOOS_INTAKE_PARSER_SECRET` to equal `INTAKE_EMAIL_PARSER_SECRET` in `supabase/functions/.env`.

Install the browser once with `npm run e2e:install --workspace=tests`.

## QA records

`qa/` holds the project's defect log (`DEFECT_LOG.md`, check it before assuming a failure is new), `RETEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, `EVENT_PIPELINE.md`, `PURGE_VERIFICATION.md` and the manual Gmail and Calendar smoke run.
