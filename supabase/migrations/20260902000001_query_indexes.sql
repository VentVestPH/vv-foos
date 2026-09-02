-- Index coverage for the columns the application actually filters and sorts on,
-- and for the foreign keys the documented demo-data purge walks.
--
-- Measured before adding: EXPLAIN (ANALYZE) against 200k synthetic activities
-- and 50k applications, inside a rolled-back transaction, showed a Bitmap Heap
-- Scan on the single-column index followed by a separate Sort node. The
-- composite indexes below remove that Sort.

create index if not exists idx_reminders_related
  on reminders (related_type, related_id);

create index if not exists idx_activities_person_occurred
  on activities (person_id, occurred_at desc);

create index if not exists idx_applications_requisition_applied
  on applications (requisition_id, applied_at desc);

create index if not exists idx_attachments_parent_kind
  on attachments (parent_type, parent_id, kind);

-- Unindexed foreign keys on the purge path. All three are ON DELETE SET NULL,
-- so deleting one person forces a sequential scan of each referencing table.
create index if not exists idx_deals_primary_contact
  on deals (primary_contact_id);

create index if not exists idx_tickets_person
  on tickets (person_id);

create index if not exists idx_intake_items_duplicate_of
  on intake_items (duplicate_of);

-- Redundant: a strict leading prefix of the unique (requisition_id, person_id)
-- index, so the planner never needs it and every write maintains it for nothing.
drop index if exists idx_applications_requisition;
