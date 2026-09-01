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
psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" -v ON_ERROR_STOP=1 \
  -c "set foos.qa_test_password = '$FOOS_QA_TEST_PASSWORD';" \
  -f tests/fixtures/personas.sql

npm run dev --workspace=app             # http://localhost:5175, now pointed at local
```

Sign in as any seeded persona with the password you chose: `demo-admin@ventvest.test` (admin), `rita.demo@ventvest.com` (recruiter), `sam.demo@ventvest.com` (sourcer), `ben.demo@ventvest.com` (bd). Put the same value in `tests/.env` as `FOOS_QA_TEST_PASSWORD` so the Vitest and Playwright suites can sign in.

`supabase stop` shuts it down. `supabase db reset` rebuilds from migrations plus seed, which is the fastest way back to a known state.

## 2. Ports, and why they are unusual

| Service | Port | Standard default |
| :---- | :---- | :---- |
| API / PostgREST | 55321 | 54321 |
| Postgres | 55322 | 54322 |
| Shadow DB | 55320 | 54320 |
| Studio | 55323 | 54323 |
| Mail catcher | 55324 | 54324 |
| Analytics | 55327 | 54327 |
| Pooler | 55329 | 54329 |

The sibling repository `Kappa-Omini-typescript` runs its own Supabase stack on the standard 543xx range on this machine. Both must run at once, so this project takes 553xx. Verified: 12 `supabase_*_VV-FoOS` containers running alongside Kappa's 12, no collision.

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
| App reads local, not hosted | Confirmed by network trace: contacts `127.0.0.1:55321`, renders 7 candidate rows (local seed) against production's 83 |

That `pg_cron` result also confirms the D14 guard added to migration 04 did not change Supabase behaviour: the jobs still schedule where `pg_cron` exists.

## 5. Environment split for hosting on Vercel or Fly

Vite loads env files in increasing priority: `.env`, then `.env.local`, then `.env.[mode]`, then `.env.[mode].local`.

| Environment | Source | Committed |
| :---- | :---- | :---- |
| Development | `app/.env.development` -> local Supabase | Yes. The keys are the standard Supabase local demo keys, byte-identical on every machine and worthless off 127.0.0.1 |
| Production | Hosting platform environment variables | No. Vercel: Project Settings > Environment Variables. Fly: `fly secrets set` |

Platform variables override every file, so a deployed build picks up the hosted project without any file change.

**One caveat worth knowing.** `app/.env` still holds the live project's keys and is loaded in every mode. `.env.development` outranks it in dev, so `npm run dev` is safely local. But `npm run build` runs in production mode, where `.env.development` is not loaded, so a **local** build silently targets the live project. On Vercel or Fly this is harmless because platform variables win. Locally, prefer `.env.production.local` (gitignored) if you ever want a local production build pointed somewhere else.

## 6. Still outstanding

**The Agent 6 RPC drift is not yet closed.** `get_my_google_status` and `disconnect_my_google` exist in production and in no migration. Reconstructing them needs their function bodies, which requires either the database password (for `supabase db dump --linked` or `supabase db diff --linked`) or a service-role introspection. Probing cannot recover a function body, and a guessed definition could overwrite correct production code on a future `db push`.

Now that local works, the moment those definitions are available the migration can be written and tested here before it goes anywhere near production.

**Not yet configured for hosting:** no `vercel.json`, `fly.toml` or `Dockerfile` exists. A Vite SPA needs a rewrite rule sending unmatched paths to `index.html`, otherwise all 12 client-side routes 404 on direct load or refresh. Worth adding before the first deploy, not before then.
