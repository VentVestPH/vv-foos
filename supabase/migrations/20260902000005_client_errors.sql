-- Client error log. Production failures are invisible today: ErrorBoundary only
-- writes to console.error, which nobody sees, and a promise rejection or an
-- event-handler throw is not caught by a boundary at all.
--
-- Deliberately not a third-party service. A route here embeds candidate and
-- requisition ids and an error message can quote a Postgres detail, so the
-- payload is candidate data. Keeping it in this database means no vendor, no
-- Content-Security-Policy change and no sourcemap upload; the cost is no
-- grouping, no release association and no alerting.
--
-- Write-only for staff: an INSERT policy scoped to auth.uid(), with SELECT and
-- DELETE for an admin only. Two consequences to remember when writing a client.
-- `insert(...).select(...)` fails for a non-admin, because RETURNING needs the
-- SELECT policy to pass, so the reporter inserts without reading back. And a
-- delete needs the admin policy: without it every teardown is refused, which is
-- silent unless the caller checks the error.
--
-- Bounded on purpose. Lengths are CHECK constraints rather than truncation, so
-- an oversized payload is a visible failure, and the client caps itself at 20
-- reports per session with de-duplication so a render loop cannot flood the
-- table.

create table if not exists client_errors (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null default auth.uid(),
  occurred_at timestamptz not null default now(),
  route text,
  origin text not null,
  message text not null,
  stack text,
  user_agent text,
  constraint client_errors_message_len check (char_length(message) <= 2000),
  constraint client_errors_stack_len check (stack is null or char_length(stack) <= 8000),
  constraint client_errors_route_len check (route is null or char_length(route) <= 500),
  constraint client_errors_origin_len check (char_length(origin) <= 120)
);

create index if not exists idx_client_errors_occurred_at on client_errors (occurred_at desc);

alter table client_errors enable row level security;

grant insert, select, delete on client_errors to authenticated;

drop policy if exists client_errors_insert on client_errors;
create policy client_errors_insert on client_errors
  for insert to authenticated
  with check (staff_id = ( select auth.uid() ));

drop policy if exists client_errors_read on client_errors;
create policy client_errors_read on client_errors
  for select to authenticated
  using (( select get_my_role() ) = 'admin');

drop policy if exists client_errors_delete on client_errors;
create policy client_errors_delete on client_errors
  for delete to authenticated
  using (( select get_my_role() ) = 'admin');

insert into retention_policy (table_name, keep_days) values ('client_errors', 30)
on conflict (table_name) do nothing;

create or replace function public.fn_prune_retained_rows()
returns table (pruned_table text, removed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_days integer;
  outbox_days integer;
  error_days integer;
  n bigint;
begin
  select keep_days into audit_days from retention_policy where table_name = 'audit_log';
  select keep_days into outbox_days from retention_policy where table_name = 'events_outbox';
  select keep_days into error_days from retention_policy where table_name = 'client_errors';

  if audit_days is not null then
    delete from audit_log where at < now() - make_interval(days => audit_days);
    get diagnostics n = row_count;
    return query select 'audit_log'::text, n;
  end if;

  if outbox_days is not null then
    delete from events_outbox
     where processed_at is not null
       and processed_at < now() - make_interval(days => outbox_days);
    get diagnostics n = row_count;
    return query select 'events_outbox'::text, n;
  end if;

  if error_days is not null then
    delete from client_errors where occurred_at < now() - make_interval(days => error_days);
    get diagnostics n = row_count;
    return query select 'client_errors'::text, n;
  end if;
end;
$$;

revoke all on function public.fn_prune_retained_rows() from public;
grant execute on function public.fn_prune_retained_rows() to service_role;
