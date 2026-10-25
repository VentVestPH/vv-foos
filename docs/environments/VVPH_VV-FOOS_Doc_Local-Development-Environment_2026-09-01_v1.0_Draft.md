# Local Development Environment

**Project:** VV-FOOS · **Date:** 2026-09-01 · v1.0 Draft

Local Supabase is now the development target. Before this, the repository had no `supabase/config.toml`, so `supabase start` and `supabase db reset` could not run at all and `supabase status` failed with `No such container: supabase_db_VV-FoOS`. Development therefore ran against the live project, which holds 76 real people, 154 recruiter assessment notes, and attachment metadata referencing identity and tax documents.

## 1. Running it

```sh
supabase start                          # first run pulls images

# Seed the four Auth personas. Choose your own password; there is no default,
# deliberately (QA-003: the previous hardcoded literal is a working credential
# against the live project, so it must not live in this repository).
export FOOS_QA_TEST_PASSWORD='choose-a-local-value'
psql "postgresql://postgres:postgres@127.0.0.1:56322/postgres" -v ON_ERROR_STOP=1 \
  -c "set foos.qa_test_password = '$FOOS_QA_TEST_PASSWORD';" \
  -f tests/support/fixtures/personas.sql

npm run dev --workspace=app             # http://localhost:5175, now pointed at local
```

Sign in as any seeded persona with the password you chose: `demo-admin@ventvest.test` (admin), `rita.demo@ventvest.com` (recruiter), `sam.demo@ventvest.com` (sourcer), `ben.demo@ventvest.com` (bd). Put the same value in `tests/.env` as `FOOS_QA_TEST_PASSWORD` so the Vitest and Playwright suites can sign in.

`supabase stop` shuts it down. `supabase db reset` rebuilds from migrations plus seed, which is the fastest way back to a known state.

## 2. Ports, and why they are unusual

| Service | Port | Standard default |
| :---- | :---- | :---- |
| API / PostgREST | 56321 | 54321 |
| Postgres | 56322 | 54322 |
| Shadow DB | 56320 | 54320 |
| Studio | 56323 | 54323 |
| Mail catcher | 56324 | 54324 |
| Analytics | 56327 | 54327 |
| Pooler | 56329 | 54329 |

FOOS uses its own project identity, Docker network, containers, volumes and 56320–56329 port range. See [the current isolation runbook](LOCAL-ISOLATION.md) for guarded lifecycle commands and Mailpit endpoints. Earlier verification results below are historical.

## 3. What the config fixes permanently

**QA-001 cannot recur locally.** `config.toml` sets `api.schemas = ["public", "graphql_public", "dash"]`. On the hosted project this is a Dashboard setting (Settings > Data API > Exposed schemas) that no migration can express, and forgetting it was defect QA-001, which broke every dashboard query with `PGRST106`. Confirmed live locally: PostgREST reports "Only the following schemas are exposed: public, graphql_public, dash".

**Auth redirects point at this frontend.** `site_url` is `http://localhost:5175`, not the CLI default of 3000.

**Postgres major version matches production**: local runs 17.6.1.141, the same image as the hosted project.

## 4. Verified working

| Check | Result |
| :---- | :---- |
| All 18 migrations apply on `supabase start` | Pass, including the two reconstructed ones |
| `seed.sql` applies | Pass |
| `validate.sql` | Passes check 1, halts at check 2 on `careers_rate_limit` (QA-002), exactly as production does |
| `pg_cron` installed | Yes, all three jobs scheduled: `foos-reminder-due`, `dash-refresh-materialized-views`, `dash-refresh-success-metrics` |
| Four personas sign in | Pass |
| `dash` views over REST as signed-in admin | HTTP 200 |
| App reads local, not hosted | Confirmed by network trace: contacts `127.0.0.1:56321`, renders 7 candidate rows (local seed) against production's 83 |

That `pg_cron` result also confirms the D14 guard added to migration 04 did not change Supabase behaviour: the jobs still schedule where `pg_cron` exists.

## 5. Environment split for hosting on Cloudflare Pages or Fly

Vite loads env files in increasing priority: `.env`, then `.env.local`, then `.env.[mode]`, then `.env.[mode].local`.

| Environment | Source | Committed |
| :---- | :---- | :---- |
| Development | `app/.env.development` -> local Supabase | Yes. The keys are the standard Supabase local demo keys, byte-identical on every machine and worthless off 127.0.0.1 |
| Production | Hosting platform environment variables | No. Cloudflare Pages: Project Settings > Environment Variables. Fly: `fly secrets set` |

Platform variables override every file, so a deployed build picks up the hosted project without any file change.

**One caveat worth knowing.** `app/.env` still holds the live project's keys and is loaded in every mode. `.env.development` outranks it in dev, so `npm run dev` is safely local. But `npm run build` runs in production mode, where `.env.development` is not loaded, so a **local** build silently targets the live project. On Cloudflare Pages or Fly this is harmless because platform variables win. Locally, prefer `.env.production.local` (gitignored) if you ever want a local production build pointed somewhere else.

## 6. Still outstanding

**The Agent 6 RPC drift is not yet closed.** `get_my_google_status` and `disconnect_my_google` exist in production and in no migration. Reconstructing them needs their function bodies, which requires either the database password (for `supabase db dump --linked` or `supabase db diff --linked`) or a service-role introspection. Probing cannot recover a function body, and a guessed definition could overwrite correct production code on a future `db push`.

Now that local works, the moment those definitions are available the migration can be written and tested here before it goes anywhere near production.

**Superseded:** `app/public/_headers` now exists with the SPA rewrite, immutable asset caching and security headers. Nothing is deployed to it.


## Deployment state, verified 2026-09-01

Everything done on 2026-09-01 was applied to the **local** stack only. Verified with `supabase migration list --linked`, which compares the repo against the hosted project's own migration ledger:

| | Count |
| :---- | :---- |
| Migrations on both local and hosted | 12 (the July 11 set) |
| In the repo, **not** on hosted | 14 |
| On hosted, with no repo counterpart | 10 |

All eight migrations written on 2026-09-01 (`20260901000001` to `20260901000008`) report `remote: ""`. **None of them is on the hosted project.** Neither are the Edge Function changes: the fail-closed guards on `intake-email-parser` and `google-sync` exist only in the repo, because `supabase functions deploy` was never run.

Every schema change in that session was applied with an explicit local connection string, `postgresql://postgres:postgres@127.0.0.1:56322/postgres`. `supabase db reset` acts on the local database only; its own output says so.

### This checkout is linked to production

`supabase/.temp/project-ref` holds `mebfbbvrqdctamnzvbbs`, set on 2026-07-11. So `supabase db push` and any other `--linked` command target the **live** project, not a staging one. Treat `npm run db:push` as a production command.

### `db push` is currently blocked, and that is a good thing

A dry run refuses:

```
LegacyDbPushMissingLocalError: Remote migration versions not found in local migrations directory.
```

Ten migrations were applied to production through the MCP connector on 2026-07-25 under generated timestamps (`20260725061955` through `20260725130101`). The repo instead carries six hand-written files (`20260725000001` to `20260725000006`) that reconstruct the same objects under different names. The ledgers cannot be reconciled by name, so the CLI stops.

**Do not follow the CLI's suggested fix without thinking.** It proposes `supabase migration repair --status reverted <the ten>` followed by `supabase db pull`. Marking them reverted and then pushing would attempt all six reconstruction files against a database where those objects already exist, which will fail partway through and may leave the schema half-changed.

The safe order when the time comes:

1. Get the database password and run `supabase db dump --linked` to capture what production actually has, including the two Agent 6 RPCs that exist in no migration.
2. Reconcile the ledger deliberately, deciding per object whether the repo file or production is correct.
3. Apply the eight September migrations to a throwaway copy of the production dump first, not to production.
4. Only then push, and only the September set.

Steps 1 and 2 are the outstanding Agent 6 RPC drift item. It is now also a prerequisite for deploying anything, not just a documentation gap.

## Corrected 2026-09-07: there is no root `.env` in this checkout

`CLAUDE.md` tabulates a root `.env` holding `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. The file **is absent**, and because it is gitignored its absence is silent: `source .env` in a shell script succeeds and sets nothing, so anything relying on `$DATABASE_URL` or `$SUPABASE_URL` from it reads empty and fails later with a confusing message. What actually exists:

| File | Variables |
| :---- | :---- |
| `app/.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `tests/.env` | `FOOS_SUPABASE_URL`, `FOOS_SUPABASE_ANON_KEY`, `FOOS_QA_TEST_PASSWORD`, `FOOS_BASE_URL`, `FOOS_INTAKE_PARSER_SECRET` |
| `supabase/functions/.env` | `INTAKE_EMAIL_PARSER_SECRET`, `GOOGLE_SYNC_SECRET`, `APP_PRIMARY_ORIGIN`, `APP_ALLOWED_ORIGINS` |
| root `.env` | **absent** |

`scripts/check-cutover.mjs` therefore reads any of the three naming conventions and names them all when none is set, rather than assuming the documented one.
