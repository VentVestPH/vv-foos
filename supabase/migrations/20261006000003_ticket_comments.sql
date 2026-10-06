-- Ticket comments. Admin and bd write, recruiters read, matching tickets_write and
-- tickets_select. Authors may edit or delete their own comments; a delete is soft so the
-- thread keeps its shape, and the guard in 20261006000004 clears the body when it happens.
-- The body may be empty when a comment carries only images.
create table if not exists public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references public.staff(id),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  edited_by uuid references public.staff(id) on delete set null,
  deleted_at timestamptz,
  deleted_by uuid references public.staff(id) on delete set null
);

alter table public.ticket_comments
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by uuid references public.staff(id) on delete set null,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.staff(id) on delete set null;

alter table public.ticket_comments drop constraint if exists ticket_comments_body_check;
alter table public.ticket_comments
  add constraint ticket_comments_body_check check (length(trim(body)) <= 10000);

create index if not exists idx_ticket_comments_ticket_created
  on public.ticket_comments (ticket_id, created_at);

alter table public.ticket_comments enable row level security;

drop policy if exists ticket_comments_select on public.ticket_comments;
create policy ticket_comments_select on public.ticket_comments
  for select to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter', 'bd'));

drop policy if exists ticket_comments_insert on public.ticket_comments;
create policy ticket_comments_insert on public.ticket_comments
  for insert to authenticated
  with check ((select public.get_my_role()) in ('admin', 'bd') and author_id = (select auth.uid()));

drop policy if exists ticket_comments_update_own on public.ticket_comments;
create policy ticket_comments_update_own on public.ticket_comments
  for update to authenticated
  using (
    (select public.get_my_role()) in ('admin', 'bd')
    and author_id = (select auth.uid())
    and deleted_at is null
  )
  with check (
    (select public.get_my_role()) in ('admin', 'bd')
    and author_id = (select auth.uid())
  );

grant select, insert on public.ticket_comments to authenticated;
grant update (body, edited_at, edited_by, deleted_at, deleted_by)
  on public.ticket_comments to authenticated;
