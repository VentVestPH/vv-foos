-- Extend the application stage set to cover the real Zoho data, and keep the
-- original Zoho status verbatim.
--
-- Klent's decision, 2026-09-03: migrate everything from Zoho with no exceptions,
-- and the FOOS stage set is not final, so it should fit the data rather than the
-- data being discarded to fit it. This deliberately overrides the "stage sets are
-- locked, do not reorder or extend" rule in CLAUDE.md, which was written when the
-- eight stages were a design commitment rather than a constraint.
--
-- What the data actually contains. Zoho Recruit has 86,125 application records
-- across 21 distinct Application_Status values, and 96% of them sit in one status
-- that had no FOOS equivalent at all:
--
--   83,022  Talent Pool                      candidate is in the pool
--    1,742  Sent InMail I (Linkedin)         sourcing outreach
--      497  Associated                       linked to an opening, not yet screened
--      191  Submitted
--      176  Do Not Pursue
--      167  Candidate To Review Info
--      116  Flag
--      104  Resume Provided By Candidate
--       39  Resume Provided by Third Party
--       30  Reference Provider
--       14  Interview in progress
--       10  Candidate Emailing Resume
--        9  Submitted to client
--        1 each  Unqualified, Sent InMail II, Sent InMail & Left VM, Sent Email I,
--                Interview-Scheduled, Interview to be scheduled, Archived, Applied
--
-- Three new stages carry the shapes that had nowhere to go. They are inserted
-- before 'received' so the enum's own sort order stays the pipeline order, which
-- is what the board and the pipeline view read.
--
--   talent_pool   pool membership, ahead of any application activity
--   outreach      an approach was made, no response yet
--   associated    attached to an opening, not yet screened
--
-- applications.source_status keeps the original Zoho string on every row. Mapping
-- 21 values onto 11 stages loses information, and this is where it is kept, so a
-- future decision can re-derive a stage without going back to Zoho.

alter type application_stage add value if not exists 'talent_pool' before 'received';
alter type application_stage add value if not exists 'outreach' before 'received';
alter type application_stage add value if not exists 'associated' before 'received';

alter table public.applications
  add column if not exists source_status text;

comment on column public.applications.source_status is
  'The verbatim Application_Status from the source system, kept because 21 Zoho statuses map onto 11 FOOS stages and the mapping is lossy.';

create index if not exists idx_applications_source_status
  on public.applications (source_status);

create index if not exists idx_applications_stage on public.applications (stage);
