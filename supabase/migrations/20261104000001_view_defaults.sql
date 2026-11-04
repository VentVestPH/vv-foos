-- Each person's last-loaded list view is remembered, so Requisitions and
-- Candidates open on it instead of on the plain list. One row per person and
-- list. If the remembered view is deleted the row keeps its place with a null
-- view_id, and the list falls back to the shared Default view.
--
-- The Requisitions list had no shared Default view, so one is added, owned by
-- the same person as the Candidates default (or the first active admin). It has
-- no filters, columns or sort, which is how the list loads today. Editing it
-- later is how the team changes what everyone sees first.

create table public.ats_view_defaults (
  staff_id uuid not null references public.staff(id) on delete cascade,
  entity text not null,
  view_id uuid references public.ats_saved_views(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (staff_id, entity)
);

alter table public.ats_view_defaults enable row level security;

create policy ats_view_defaults_select on public.ats_view_defaults
  for select to authenticated
  using (staff_id = (select auth.uid()));

create policy ats_view_defaults_insert on public.ats_view_defaults
  for insert to authenticated
  with check (staff_id = (select auth.uid()));

create policy ats_view_defaults_update on public.ats_view_defaults
  for update to authenticated
  using (staff_id = (select auth.uid()))
  with check (staff_id = (select auth.uid()));

create policy ats_view_defaults_delete on public.ats_view_defaults
  for delete to authenticated
  using (staff_id = (select auth.uid()));

grant select, insert, update, delete on public.ats_view_defaults to authenticated;

comment on table public.ats_view_defaults is
  'The list view each person last loaded, per list. Read and written only by that person.';

insert into public.ats_saved_views (staff_id, entity, name, is_shared, filters, columns, sort)
select owner.id, 'requisition', 'Default', true, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb
from (
  select coalesce(
    (select v.staff_id from public.ats_saved_views v
      where v.entity = 'candidate' and v.is_shared and v.name = 'Default' limit 1),
    (select s.id from public.staff s where s.role = 'admin' and s.is_active order by s.id limit 1)
  ) as id
) owner
where owner.id is not null
  and not exists (
    select 1 from public.ats_saved_views v
    where v.entity = 'requisition' and v.is_shared and v.name = 'Default'
  );
