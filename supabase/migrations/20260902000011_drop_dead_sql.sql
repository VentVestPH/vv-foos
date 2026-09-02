-- S8: SQL nothing uses.
--
-- clear_google_tokens(uuid) is dead. Nothing in the app, no policy, no trigger,
-- no column default and no other function calls it: disconnect_my_google
-- inlines the same two deletes rather than calling it, which is also why
-- keeping both invites drift. It is security definer, so dropping it removes an
-- unused privileged entry point rather than merely tidying.
--
-- Two indexes are strict prefixes of another index on the same table, so the
-- wider one already serves every lookup the narrow one did, and the narrow one
-- only costs write time and space:
--   idx_activities_person (person_id)
--     covered by idx_activities_person_occurred (person_id, occurred_at desc)
--   idx_attachments_parent (parent_type, parent_id)
--     covered by idx_attachments_parent_kind (parent_type, parent_id, kind)
--
-- Deliberately NOT dropped: idx_integration_settings_staff (staff_id). Its only
-- cover is uq_integration_settings_staff_key, which is **partial**
-- (where staff_id is not null). The planner can use a partial index when the
-- query implies its predicate, and `staff_id = $1` does, so it is redundant in
-- theory; the table is tiny, the reasoning is one step less direct than the
-- other two, and the saving is not worth being clever about.

drop function if exists public.clear_google_tokens(uuid);

drop index if exists idx_activities_person;
drop index if exists idx_attachments_parent;
