-- Zoho migration: give every pulled field a destination.
--
-- The 2026-09-09 API sweep found 16 record-bearing modules holding 383,334
-- records, where the importer covered 11. Five modules had no destination at
-- all (To_Dos 11,772, Reviews 335, CRM Tasks 54, CRM Events 2,
-- Calendly_Invites 1) and companies silently dropped seven Zoho fields across
-- 86 rows. This migration closes both.
--
-- companies gains the seven columns mapCompany was carrying and discarding.
--
-- activities gains ends_at, location and all_day because Zoho's To_Dos and CRM
-- Events carry an end time, a venue and an all-day flag that the single
-- occurred_at column cannot express. A meeting that ran 09:00 to 17:00 is not
-- the same record as one at 09:00, and losing the distinction is losing data.
--
-- activities and tasks both gain source_payload. First-class columns are added
-- only where the semantics are obvious; Zoho also emits per-record metadata
-- ($approval_state, $process_flow, Check_In_Status, Reviewed_By, Rating,
-- Qualified and so on) that has no meaning in this schema but is still data
-- that was asked for. source_payload holds the complete original record so
-- nothing is discarded, and a later migration can promote any field out of it
-- without re-reading Zoho.

alter table public.companies
  add column if not exists account_number text,
  add column if not exists description text,
  add column if not exists email text,
  add column if not exists industry text,
  add column if not exists postal_code text,
  add column if not exists site text,
  add column if not exists street text;

alter table public.activities
  add column if not exists ends_at timestamptz,
  add column if not exists location text,
  add column if not exists all_day boolean not null default false,
  add column if not exists source_payload jsonb;

alter table public.tasks
  add column if not exists completed_at timestamptz,
  add column if not exists source_payload jsonb;

create index if not exists activities_ends_at_idx
  on public.activities (ends_at)
  where ends_at is not null;
