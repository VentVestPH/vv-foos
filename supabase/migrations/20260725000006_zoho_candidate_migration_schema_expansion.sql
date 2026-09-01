-- Schema expansion for the Zoho Recruit candidate migration.
--
-- PROVENANCE: applied directly to the live project (mebfbbvrqdctamnzvbbs) on
-- 2026-07-25 via the Supabase MCP connector, as migration
-- "zoho_candidate_migration_schema_expansion", and never committed here. This
-- file reconstructs it. See the defect register (D3).
--
-- All changes are additive. No existing column is renamed or dropped, so both
-- /foos and /foos_redesign_2 keep working unmodified.
--
-- COLUMN TYPES VERIFIED AGAINST PRODUCTION 2026-09-01 by probing PostgREST
-- with deliberately invalid filter values and reading the type out of the
-- error (read-only, non-mutating):
--   people.street                        -> text      (filter accepted)
--   people.experience                    -> json/jsonb ("invalid input syntax for type json")
--   candidate_profiles.expected_salary   -> numeric   ("...for type numeric")
--   candidate_profiles.current_salary    -> numeric   ("...for type numeric")
--   candidate_profiles.salary_currency   -> text      (filter accepted)
--   candidate_profiles.assessment_scores -> json/jsonb ("invalid input syntax for type json")
--   attachments.file_size_bytes          -> integer   ("...for type integer")
--   zoho_id_map                          -> exists; returns 42501 permission
--                                           denied for role authenticated,
--                                           which is the intended service-role-only design
--
-- RESIDUAL UNCERTAINTY: NOT NULL and DEFAULT could not be read back through
-- PostgREST. They are reproduced from the applied DDL recorded in
-- VVPH_VV-FOOS_Plan_Zoho-Recruit-Candidate-Migration section 2, and are
-- consistent with live reads (experience returns [], assessment_scores
-- returns {} on existing rows). Confirm with a service-role introspection or
-- pg_dump before treating this file as byte-exact.

-- ---------------------------------------------------------------- people
-- street: address completeness. 1% filled in the 75-row Zoho sample, added so
-- the few candidates that have it are not silently dropped.
-- experience: multi-employer work history. candidate_profiles holds only one
-- current employer, so full history needs its own array. Currently empty on
-- every row: Zoho's Experience Details export contained linking columns only
-- and needs re-exporting before this can carry data.
alter table public.people
  add column if not exists street text,
  add column if not exists experience jsonb not null default '[]'::jsonb;

-- ------------------------------------------------------ candidate_profiles
-- expected_salary / current_salary: 13% and 15% filled in the sample. Numeric
-- rather than folded into the free-text salary_flag.
-- assessment_scores: one jsonb bundle for Zoho's 9 pre-screening assessment
-- fields (20-27% fill), rather than 9 relational columns.
alter table public.candidate_profiles
  add column if not exists expected_salary numeric,
  add column if not exists current_salary numeric,
  add column if not exists salary_currency text,
  add column if not exists assessment_scores jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------- attachments
-- file_size_bytes: available from the Zoho metadata export even though the
-- file bytes themselves were not included.
alter table public.attachments
  add column if not exists file_size_bytes integer;

-- ------------------------------------------------------------- comments
comment on column public.people.education is
  'jsonb array. Each entry: {university (Zoho University), bachelor_discipline (Zoho Bachelor Discipline), year (Zoho Year), higher_degrees (Zoho Higher Degrees), other_degrees (Zoho Other Degrees)}. Field set fixed 2026-07-25 per the Zoho Recruit migration plan.';
comment on column public.people.experience is
  'Multi-employer work history, jsonb array. Mirrors people.education shape. Populated once Zoho Experience Details is re-exported with full fields.';
comment on column public.candidate_profiles.assessment_scores is
  'jsonb bundle of the 9 Zoho pre-screening assessment fields, preserved as-is rather than split into columns.';

-- --------------------------------------------------------- zoho_id_map
-- Permanent, not dropped after migration: it is what makes the import
-- re-runnable (skip-if-already-mapped) and answers "where did this record come
-- from" for any later support question. Also the join key for a future Zoho
-- CRM migration, since Notes and Attachments carry Job Opening Id and Client Id.
--
-- RLS is enabled with NO policies, which is deliberate: only the service role
-- reaches it. Verified live, an authenticated admin gets 42501.
create table if not exists public.zoho_id_map (
  id uuid primary key default gen_random_uuid(),
  zoho_id text not null,
  entity_type text not null check (entity_type in ('candidate','attachment','note','requisition','company','contact')),
  foos_id uuid not null,
  imported_at timestamptz not null default now(),
  unique (zoho_id, entity_type)
);
alter table public.zoho_id_map enable row level security;

-- ------------------------------------------------- candidate_statuses seed
-- The repo seed (supabase/seed.sql) creates 4 rows. Zoho's real usage adds 14
-- more, giving the 18 verified live on 2026-09-01. Labels are imported verbatim
-- and never renamed, per architecture section 2.2.
--
-- NOTE: Zoho's 'Hired' is folded into the existing 'Placed' row rather than
-- added separately. Flag if Hired and Placed are distinct milestones in
-- practice; that decision was defaulted, not confirmed.
insert into public.candidate_statuses (label, sort_order) values
  ('Applied',                       5),
  ('Submitted',                     6),
  ('Interview',                     7),
  ('Interviewed',                   8),
  ('Assessment stage',              9),
  ('No Show',                      10),
  ('Failed Interview',             11),
  ('Rejected',                     12),
  ('Withdrew',                     13),
  ('Do Not Pursue',                14),
  ('Unqualified',                  15),
  ('Talent Pool',                  16),
  ('Future Pool',                  17),
  ('Resume Provided By Candidate', 18)
on conflict (label) do nothing;

-- --------------------------------------------------------- sources seed
-- The repo seed creates 7 rows. Zoho's real usage adds 5, giving the 12
-- verified live on 2026-09-01.
--
-- KNOWN DISCREPANCY (defect D4): the Zoho export's actual value is
-- 'Digital Assistant - Facebook Messenger'. The row seeded live, and therefore
-- reproduced here, is 'Digital Assistant - FB Messenger'. This file's job is to
-- reproduce production exactly; correcting the name is a separate change so the
-- two are not conflated.
insert into public.sources (name) values
  ('Advertisement'),
  ('Added by User'),
  ('Digital Assistant - FB Messenger'),
  ('Facebook'),
  ('Internal')
on conflict (name) do nothing;
