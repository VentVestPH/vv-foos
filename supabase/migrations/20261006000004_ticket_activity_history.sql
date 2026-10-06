-- Ticket activity: comment images, ticket-to-ticket links (with blocking-cycle prevention),
-- external links, and an append-only ticket_history written only by triggers.
-- ticket_comments itself is defined in 20261006000003. The comment guard keeps ownership
-- immutable and makes a delete remove the comment's content: the body is cleared and the
-- body-bearing history entries for that comment are emptied, leaving only who did what when.
-- A link removed by the cascade from deleting its ticket writes no history, because the
-- ticket it would be written against is already gone.
create table if not exists public.ticket_comment_images (
  comment_id uuid not null references public.ticket_comments(id) on delete cascade,
  attachment_id uuid not null unique references public.attachments(id) on delete cascade,
  primary key (comment_id, attachment_id)
);

create table if not exists public.ticket_links (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  linked_ticket_id uuid not null references public.tickets(id) on delete cascade,
  relationship text not null check (relationship in ('blocks', 'relates_to')),
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ticket_id <> linked_ticket_id),
  unique (ticket_id, linked_ticket_id, relationship)
);

create index if not exists idx_ticket_links_linked on public.ticket_links (linked_ticket_id);

create or replace function public.fn_ticket_link_prevent_cycle()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.relationship <> 'blocks' then return new; end if;
  perform pg_advisory_xact_lock(628202610);
  if exists (
    with recursive reachable(ticket_id) as (
      select new.linked_ticket_id
      union
      select link.linked_ticket_id
      from public.ticket_links link
      join reachable on reachable.ticket_id = link.ticket_id
      where link.relationship = 'blocks'
    )
    select 1 from reachable where ticket_id = new.ticket_id
  ) then
    raise exception 'This dependency would create a ticket blocking cycle';
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_link_prevent_cycle on public.ticket_links;
create trigger trg_ticket_link_prevent_cycle
  before insert on public.ticket_links
  for each row execute function public.fn_ticket_link_prevent_cycle();

create table if not exists public.ticket_external_links (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  url text not null check (length(url) <= 2048 and url ~* '^https?://'),
  label text not null check (length(trim(label)) between 1 and 160),
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_external_links_ticket
  on public.ticket_external_links (ticket_id, created_at);

create table if not exists public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references public.staff(id) on delete set null,
  event_type text not null check (event_type in (
    'ticket_created', 'ticket_updated', 'comment_added', 'comment_edited', 'comment_deleted',
    'ticket_linked', 'ticket_unlinked', 'resource_linked', 'resource_unlinked'
  )),
  comment_id uuid references public.ticket_comments(id) on delete set null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ticket_history_ticket_created
  on public.ticket_history (ticket_id, created_at desc, id);

alter table public.ticket_comment_images enable row level security;
alter table public.ticket_history enable row level security;
alter table public.ticket_links enable row level security;
alter table public.ticket_external_links enable row level security;

drop policy if exists ticket_comment_images_select on public.ticket_comment_images;
create policy ticket_comment_images_select on public.ticket_comment_images
  for select to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter', 'bd'));

drop policy if exists ticket_comment_images_insert on public.ticket_comment_images;
create policy ticket_comment_images_insert on public.ticket_comment_images
  for insert to authenticated
  with check (
    (select public.get_my_role()) in ('admin', 'bd')
    and exists (
      select 1 from public.ticket_comments c
      join public.attachments a on a.parent_type = 'ticket' and a.parent_id = c.ticket_id
      where c.id = comment_id and c.author_id = (select auth.uid()) and a.id = attachment_id
    )
  );

drop policy if exists ticket_history_select on public.ticket_history;
create policy ticket_history_select on public.ticket_history
  for select to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter', 'bd'));

drop policy if exists ticket_links_select on public.ticket_links;
create policy ticket_links_select on public.ticket_links
  for select to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter', 'bd'));

drop policy if exists ticket_links_insert on public.ticket_links;
create policy ticket_links_insert on public.ticket_links
  for insert to authenticated
  with check ((select public.get_my_role()) in ('admin', 'bd') and created_by = (select auth.uid()));

drop policy if exists ticket_links_delete on public.ticket_links;
create policy ticket_links_delete on public.ticket_links
  for delete to authenticated
  using ((select public.get_my_role()) in ('admin', 'bd') and created_by = (select auth.uid()));

drop policy if exists ticket_external_links_select on public.ticket_external_links;
create policy ticket_external_links_select on public.ticket_external_links
  for select to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter', 'bd'));

drop policy if exists ticket_external_links_insert on public.ticket_external_links;
create policy ticket_external_links_insert on public.ticket_external_links
  for insert to authenticated
  with check ((select public.get_my_role()) in ('admin', 'bd') and created_by = (select auth.uid()));

drop policy if exists ticket_external_links_delete on public.ticket_external_links;
create policy ticket_external_links_delete on public.ticket_external_links
  for delete to authenticated
  using ((select public.get_my_role()) in ('admin', 'bd') and created_by = (select auth.uid()));

grant select on public.ticket_comment_images, public.ticket_history, public.ticket_links,
  public.ticket_external_links to authenticated;
grant insert on public.ticket_comment_images to authenticated;
grant insert, delete on public.ticket_links to authenticated;
grant insert, delete on public.ticket_external_links to authenticated;

create or replace function public.fn_ticket_comment_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and old.author_id is distinct from auth.uid() then
    raise exception 'Only the comment author can edit or delete this comment';
  end if;
  if old.deleted_at is not null then
    raise exception 'Deleted comments cannot be changed';
  end if;
  if new.ticket_id is distinct from old.ticket_id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Comment ownership and ticket are immutable';
  end if;
  if new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null then
    new.body := '';
    new.deleted_at := now();
    new.deleted_by := auth.uid();
    new.edited_at := old.edited_at;
    new.edited_by := old.edited_by;
  elsif new.body is distinct from old.body then
    if length(trim(new.body)) not between 1 and 10000 then
      raise exception 'Comment must contain between 1 and 10000 characters';
    end if;
    new.edited_at := now();
    new.edited_by := auth.uid();
    new.deleted_at := null;
    new.deleted_by := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_comment_guard on public.ticket_comments;
create trigger trg_ticket_comment_guard
  before update on public.ticket_comments
  for each row execute function public.fn_ticket_comment_guard();

create or replace function public.fn_ticket_history_from_ticket()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  field_key text;
  diff jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_history (ticket_id, actor_id, event_type, changes)
    values (new.id, auth.uid(), 'ticket_created', jsonb_build_object('subject', new.subject));
    return new;
  end if;

  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  for field_key in select jsonb_object_keys(new_row) loop
    if field_key not in ('updated_at') and old_row -> field_key is distinct from new_row -> field_key then
      diff := diff || jsonb_build_object(field_key, jsonb_build_object(
        'from', old_row -> field_key,
        'to', new_row -> field_key
      ));
    end if;
  end loop;
  if diff <> '{}'::jsonb then
    insert into public.ticket_history (ticket_id, actor_id, event_type, changes)
    values (new.id, auth.uid(), 'ticket_updated', diff);
  end if;
  return new;
end $$;

drop trigger if exists trg_ticket_history_insert on public.tickets;
create trigger trg_ticket_history_insert
  after insert on public.tickets
  for each row execute function public.fn_ticket_history_from_ticket();

drop trigger if exists trg_ticket_history_update on public.tickets;
create trigger trg_ticket_history_update
  after update on public.tickets
  for each row execute function public.fn_ticket_history_from_ticket();

create or replace function public.fn_ticket_history_from_comment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  event_name text;
  diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_history (ticket_id, actor_id, event_type, comment_id, changes)
    values (new.ticket_id, auth.uid(), 'comment_added', new.id,
      jsonb_build_object('body', new.body));
    return new;
  end if;

  if old.deleted_at is distinct from new.deleted_at and new.deleted_at is not null then
    event_name := 'comment_deleted';
    diff := '{}'::jsonb;
    update public.ticket_history set changes = '{}'::jsonb
    where comment_id = new.id and event_type in ('comment_added', 'comment_edited');
  elsif old.body is distinct from new.body then
    event_name := 'comment_edited';
    diff := jsonb_build_object('from', old.body, 'to', new.body);
  else
    return new;
  end if;
  insert into public.ticket_history (ticket_id, actor_id, event_type, comment_id, changes)
  values (new.ticket_id, auth.uid(), event_name, new.id, diff);
  return new;
end $$;

drop trigger if exists trg_ticket_history_from_comment on public.ticket_comments;
create trigger trg_ticket_history_from_comment
  after insert or update on public.ticket_comments
  for each row execute function public.fn_ticket_history_from_comment();

create or replace function public.fn_ticket_history_from_link()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  event_name text;
  target_ticket uuid;
  detail jsonb;
begin
  if tg_table_name = 'ticket_links' then
    target_ticket := case when tg_op = 'INSERT' then new.ticket_id else old.ticket_id end;
    if tg_op = 'INSERT' then
      event_name := 'ticket_linked';
      detail := jsonb_build_object('linked_ticket_id', new.linked_ticket_id, 'relationship', new.relationship);
    else
      event_name := 'ticket_unlinked';
      detail := jsonb_build_object('linked_ticket_id', old.linked_ticket_id, 'relationship', old.relationship);
    end if;
  else
    target_ticket := case when tg_op = 'INSERT' then new.ticket_id else old.ticket_id end;
    if tg_op = 'INSERT' then
      event_name := 'resource_linked';
      detail := jsonb_build_object('url', new.url, 'label', new.label);
    else
      event_name := 'resource_unlinked';
      detail := jsonb_build_object('url', old.url, 'label', old.label);
    end if;
  end if;
  if tg_op = 'DELETE' and not exists (select 1 from public.tickets where id = target_ticket) then
    return old;
  end if;
  insert into public.ticket_history (ticket_id, actor_id, event_type, changes)
  values (target_ticket, auth.uid(), event_name, detail);
  if tg_op = 'INSERT' then return new; end if;
  return old;
end $$;

drop trigger if exists trg_ticket_history_link on public.ticket_links;
create trigger trg_ticket_history_link after insert or delete on public.ticket_links
  for each row execute function public.fn_ticket_history_from_link();

drop trigger if exists trg_ticket_history_external_link on public.ticket_external_links;
create trigger trg_ticket_history_external_link after insert or delete on public.ticket_external_links
  for each row execute function public.fn_ticket_history_from_link();
