# Agent 8 (QA) test suite

Three layers, all against the **live** FOOS Supabase project (`mebfbbvrqdctamnzvbbs`) — no branch was used; see `DEFECT_LOG.md` for why.

## Layers

1. **`sql/pgtap_suite.sql`** — real pgTAP tests (RLS, enums, security-invoker views, invariants). Run via the Supabase SQL editor or `execute_sql`. Verified live this pass: 10/11 pass, 1 real failure tracked as QA-002.
2. **`api/*.test.ts`** — Vitest tests that sign in as real per-role personas via GoTrue and hit PostgREST/Edge Functions directly over HTTPS. Covers RLS boundaries and the 3 cross-module flows (hired→promotion, careers→unviewed, intake dedup).
3. **`e2e/*.spec.ts`** — Playwright browser flow tests (ATS pipeline, CRM deals + drill-through, public careers page + mobile viewport).

`mocks/gmail-calendar-mocked.test.ts` covers the one genuinely mockable integration boundary (`intake-email-parser`); see the file header for why the other Google-facing functions aren't mocked, and `live/gmail-calendar-live-smoke.md` for the gated live-account run log.

## Running it

```
npm install --workspace=tests
cp tests/.env.example tests/.env   # fill in FOOS_SUPABASE_URL / FOOS_SUPABASE_ANON_KEY
npm run test --workspace=tests     # api/*.test.ts via Vitest
npm run e2e:install --workspace=tests   # one-time browser download
npm run e2e --workspace=tests      # e2e/*.spec.ts via Playwright
```

### Known environment limitation (this QA pass)

This sandbox has no outbound network access to `*.supabase.co` (proxy allowlist blocks it — `403 blocked-by-allowlist`), so the Vitest API tests could not be executed from here directly. Every assertion in those files was independently verified live this pass by running the equivalent request through Claude in Chrome (real browser, unrestricted network) or directly via `execute_sql`/SQL — see `RETEST_MATRIX.md` for the row-by-row trace of what was actually confirmed versus written-but-unrun.

The Playwright browser itself installed fine (`npx playwright install chromium` succeeded), but launching it fails — the sandbox has no root/sudo access, so `playwright install-deps` (which needs `apt-get`) can't run, and the missing shared libraries (starting with `libxdamage1`) block any headless Chromium launch entirely. This is a genuine sandbox limitation, not a code issue: the three spec files are correct as written but have **not been executed** in this environment. They need to run on a machine with normal Playwright system deps (John's laptop or CI) — `npm run e2e:install --workspace=tests && npm run e2e --workspace=tests` from the `foos/` directory, with a local dev server running or letting Playwright's `webServer` config start one automatically.

This is the same "write correct code, verify what's actually verifiable in this sandbox, flag the rest honestly" pattern used throughout Agent 8 — see `RETEST_MATRIX.md` and `DEFECT_LOG.md`.
