-- Q5: a saved view can be shared with the team.
--
-- Views were per-staff by design and an e2e test asserts one staff member
-- cannot see another's. That stays true for a private view. What was missing is
-- the team case: "the roles Amir is screening" had to be rebuilt by each person.
--
-- Only the owner or an admin can edit or delete a shared view, so sharing gives
-- read access and nothing else. The SELECT policy is therefore separate from the
-- write policies rather than one `for all`, which is what made this need a
-- migration rather than a column.

alter table ats_saved_views
  add column if not exists is_shared boolean not null default false;

create index if not exists idx_ats_saved_views_shared
  on ats_saved_views (entity, is_shared)
  where is_shared;

drop policy if exists ats_saved_views_all on ats_saved_views;

drop policy if exists ats_saved_views_read on ats_saved_views;
create policy ats_saved_views_read on ats_saved_views
  for select to authenticated
  using (
    ( select get_my_role() ) = 'admin'
    or staff_id = ( select auth.uid() )
    or is_shared
  );

drop policy if exists ats_saved_views_insert on ats_saved_views;
create policy ats_saved_views_insert on ats_saved_views
  for insert to authenticated
  with check (
    ( select get_my_role() ) = 'admin'
    or staff_id = ( select auth.uid() )
  );

drop policy if exists ats_saved_views_update on ats_saved_views;
create policy ats_saved_views_update on ats_saved_views
  for update to authenticated
  using (
    ( select get_my_role() ) = 'admin'
    or staff_id = ( select auth.uid() )
  )
  with check (
    ( select get_my_role() ) = 'admin'
    or staff_id = ( select auth.uid() )
  );

drop policy if exists ats_saved_views_delete on ats_saved_views;
create policy ats_saved_views_delete on ats_saved_views
  for delete to authenticated
  using (
    ( select get_my_role() ) = 'admin'
    or staff_id = ( select auth.uid() )
  );
