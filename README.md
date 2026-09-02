# VentVest Front Office OS (FOOS)

> **One frontend.** `foos_redesign_2` (port 5175) is the only frontend under change as of 2026-09-02. `/foos` (5173) and `/foos_redesign` (5174) are archived: not deleted, but frozen, and changes are not ported into them.

Schema and backend for the VentVest ATS + CRM platform. Supabase (Postgres, Auth, Storage, Edge Functions, Realtime) with React on top. This repo currently holds the database layer built by Agent 1; the app workspace (`app/`) arrives with Agents 2-7.

## Setup

1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) and log in.
2. Copy `.env.example` to `.env` and fill in keys from the dashboard (Project Settings > API). Real keys never enter git.
3. Link and push:

```sh
supabase link --project-ref mebfbbvrqdctamnzvbbs
supabase db push          # applies supabase/migrations/ in order
psql "$DATABASE_URL" -f supabase/seed.sql   # or: supabase db reset (applies migrations + seed locally)
```

Manual dashboard steps the migrations cannot do:
- Auth: enable Google OAuth restricted to the ventvest.com hosted domain, plus email/password fallback.
- Confirm pg_cron is enabled (Database > Extensions); migration 10 then schedules `foos-reminder-due` every minute. Without pg_cron, schedule `select public.fn_fire_due_reminders()` externally.
- Every `staff.id` must equal the matching `auth.users.id`. There is no hard FK to `auth.users` (keeps migrations and seeds runnable on plain Postgres); the signup hook owns that invariant.

## Migration order

Files in `supabase/migrations/` apply lexically; each holds one concern:

| # | File | Contents |
|---|---|---|
| 01 | extensions | pgcrypto; pg_cron when available |
| 02 | enums | staff role, all stage sets, intake/engagement value sets |
| 03 | sequences | REQ/APP/DEAL/TKT display-code sequences, `next_display_code()`, `fn_set_updated_at()` |
| 04 | shared_core | staff, people, companies, sources, candidate_statuses, audit_log, events_outbox |
| 05 | ats | candidate_profiles, requisitions (+owners/approvers), applications, application_views, intake_items |
| 06 | crm | contact_profiles, deals, tickets |
| 07 | engagement | activities, tasks, reminders, attachments |
| 08 | approved_additions | ats_saved_views, intake_mapping_templates, integration_settings (Gate 2) |
| 09 | indexes | people dedup (normalized primary email, LinkedIn URL), FK lookups, unviewed-counter index |
| 10 | triggers | updated_at, audit_log writer, 9 outbox events, stage bookkeeping, `fn_fire_due_reminders()` + cron job |
| 11 | rls | `get_my_role()` and helpers, deny-by-default policies per the architecture section 5 matrix, grants |
| 12 | storage | attachments bucket + object policies (no-op outside Supabase) |

`supabase/seed.sql` loads lookups, the admin staff row, and an `is_test` demo dataset. The three Taleo candidate statuses are seeded verbatim; the complete list exports from Taleo's Main Status dropdown at Phase 4 migration and imports as-is, nothing renamed. Rita/Sam/Ben are demo staff (one per role) so RLS is demonstrable; staff has no `is_test` flag, delete those three rows before cutover.

Test-data purge before cutover, in this order:

```sql
delete from people where is_test;
delete from requisitions where is_test;
delete from deals where is_test;
delete from companies where is_test;
```

## Local validation

The suite runs on plain Postgres 14+, no Supabase needed:

```sh
createdb foos
psql foos -f supabase/tests/local_shim.sql        # LOCAL ONLY: auth.uid() + role stand-ins
for f in supabase/migrations/*.sql; do psql foos -v ON_ERROR_STOP=1 -f "$f"; done
psql foos -v ON_ERROR_STOP=1 -f supabase/seed.sql
psql foos -v ON_ERROR_STOP=1 -f supabase/tests/validate.sql
```

Never run `local_shim.sql` on the hosted project; Supabase provides `auth.uid()` and the anon/authenticated/service_role roles itself.

`validate.sql` asserts: all 24 tables, RLS on every table, required triggers, display-code format and progression, the applications unique constraint, star_grade and stage-enum rejection, audit + outbox + status_change activity on every transition, `stage_changed_at`/`hired_at` maintenance, reminder.due firing, seed counts, per-role RLS boundaries, and a rolled-back is_test purge.

Limits of local RLS testing: policies are exercised by setting `request.jwt.claims` with `set_config()` and switching to the `authenticated` role, which simulates a signed-in staff user. Real JWT issuance, the Google ventvest.com domain restriction, and Storage signed-URL behavior need Supabase Auth and are verified on the hosted project (Agent 8 extends coverage there).

## Design notes

- Security lives in the database. Role comes from `staff.role` looked up via `auth.uid()` (`get_my_role()`, security definer) - never from a client parameter. Deny-by-default: RLS is enabled on every table; a leaked anon key without a session gets nothing.
- Dual-profile people: recruiters see people with candidate_profiles, BD sees people with contact_profiles, sourcers see only candidates they sourced (grade fields writable, guarded by trigger). Recruiters and BD also see profileless people they created, so a fresh insert stays visible until its profile row lands.
- `events_outbox` rows carry event_name, aggregate_id, payload, created_at, processed_at (null = pending). Edge Functions consume with the service role, which bypasses RLS.
- `integration_settings` uses two partial unique indexes instead of `unique nulls not distinct` so the schema also runs on Postgres 14.
- `audit_log` writes come from a generic security definer trigger on every business table; application_views and integration_settings are excluded (per-user view markers and sync-cursor churn would drown the log).
