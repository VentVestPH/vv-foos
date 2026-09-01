-- D26: stop attachment storage objects from becoming permanently undeletable.
--
-- storage.objects has a DELETE policy (attachments_remove) that matches on an
-- existing public.attachments row for the same storage_path. Delete the row
-- first and the object can never be removed again: remove() returns an empty
-- array with no error, so the caller cannot even tell the file survived.
-- Verified on the local stack on 2026-09-01. 317 objects had accumulated.
--
-- Two causes. Intake-staged files never get an attachments row at all: the
-- email parser records them in intake_items.parsed, and only a later import
-- creates the row, so a rejected intake item's resume is unreachable forever.
-- And deleting a person leaves both the row and the object behind, because
-- attachments.parent_id carries no foreign key (deliberately, so migrations
-- stay runnable on plain Postgres).
--
-- This adds a deletion queue rather than trying to delete from storage in SQL,
-- which Postgres cannot do. A trigger records the storage_path of every
-- removed attachments row; anything left in the queue is a file that still
-- needs deleting through the Storage API. scripts/purge-orphan-attachments.mjs
-- drains it, and the same table makes an unattended sweep possible later.
--
-- The queue is admin-readable only: a storage path contains a person id, so
-- the queue is a list of who had files removed.

create table if not exists public.attachment_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  parent_type text,
  parent_id uuid,
  queued_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_attachment_deletion_queue_pending
  on public.attachment_deletion_queue (queued_at)
  where deleted_at is null;

create unique index if not exists idx_attachment_deletion_queue_path
  on public.attachment_deletion_queue (storage_path)
  where deleted_at is null;

alter table public.attachment_deletion_queue enable row level security;

drop policy if exists attachment_deletion_queue_admin on public.attachment_deletion_queue;
create policy attachment_deletion_queue_admin on public.attachment_deletion_queue
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

create or replace function public.fn_queue_attachment_deletion()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.attachment_deletion_queue (storage_path, parent_type, parent_id)
  values (old.storage_path, old.parent_type, old.parent_id)
  on conflict (storage_path) where deleted_at is null do nothing;
  return old;
end $function$;

drop trigger if exists trg_attachments_queue_deletion on public.attachments;

create trigger trg_attachments_queue_deletion
  after delete on public.attachments
  for each row execute function public.fn_queue_attachment_deletion();

-- Migration 11 granted table privileges with a one-time
-- `grant all on all tables in schema public to authenticated, service_role`,
-- so any table created afterwards has none and is invisible to the app however
-- its policies read. Postgres checks GRANTs before RLS. Granted explicitly here;
-- the admin-only policy above is what actually restricts access.
grant select, insert, update, delete on public.attachment_deletion_queue
  to authenticated, service_role;
