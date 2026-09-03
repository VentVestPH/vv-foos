-- The Zoho source and candidate-status values FOOS had no row for.
--
-- Found by reading the importer's own unresolved report instead of skimming it.
-- It said "unresolved source: 17 distinct value(s) across 3,960 row(s)" and
-- "unresolved status: 12 distinct value(s) across 12,469 row(s)". A distinct
-- count of 17 looks small; the row count is the number that matters. Without
-- these rows, 3,960 candidates import with no source and 12,469 with no status,
-- and both are columns a recruiter filters on.
--
-- Sources are the job boards and channels the sourcing team actually used.
-- 'LinkdIn' is deliberately absent: it is a misspelling of LinkedIn in Zoho, one
-- record, and it is handled by SOURCE_ALIASES in the mapper rather than by
-- creating a misspelled row that would sit in every source dropdown forever.
--
-- Statuses are the candidate-level outreach states, which are distinct from the
-- application stage set that migration 20260903000002 extended. They are
-- appended after the existing 18 rather than interleaved into the sort order,
-- because renumbering rows the UI already orders by is a change to existing
-- behaviour and this migration is only meant to stop dropping data.

insert into public.sources (name)
select v.name
from (values
  ('Monster'),
  ('HotJobs'),
  ('Dice'),
  ('The Ladders'),
  ('ZoomInfo'),
  ('LinkSV'),
  ('Google import'),
  ('Craig''s List'),
  ('CareerBuilder'),
  ('Indeed Resume'),
  ('MEPJOBS'),
  ('LinkedIn Job Board'),
  ('Sourcing Center'),
  ('ZipRecruiter'),
  ('Upwork'),
  ('Vendor')
) as v(name)
where not exists (
  select 1 from public.sources s where lower(s.name) = lower(v.name)
);

insert into public.candidate_statuses (label, sort_order, is_active)
select v.label, v.sort_order, true
from (values
  ('Sent Email I', 19),
  ('Sent Email II', 20),
  ('Sent InMail II (Linkedin)', 21),
  ('Sent Email & InMail', 22),
  ('Sent Email & Left VM', 23),
  ('Sent InMail & Left VM', 24),
  ('Left Voicemail I', 25),
  ('Left Voicemail II', 26),
  ('Candidate Emailing Resume', 27),
  ('Reference Provider', 28),
  ('Submitted & considered weak', 29),
  ('Flag', 30)
) as v(label, sort_order)
where not exists (
  select 1 from public.candidate_statuses c where lower(c.label) = lower(v.label)
);
