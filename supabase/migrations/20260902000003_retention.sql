-- Retention for the two tables that grow without bound.
--
-- audit_log receives a row from a security-definer trigger on every write to
-- every business table. On a development database with ten seeded people it had
-- already reached 64,344 rows and 43 MB purely from test runs, so in production
-- it grows with use and nothing ever removed a row.
--
-- events_outbox keeps every event after processed_at is set. Consumers only ever
-- read pending rows, so processed history serves no runtime purpose.
--
-- Defaults are deliberately conservative. An audit trail has evidential value,
-- so a year is kept rather than a month, and the window is a settings row rather
-- than a literal so it can be changed without a migration.

create table if not exists retention_policy (
  table_name text primary key,
  keep_days integer not null check (keep_days > 0),
  updated_at timestamptz not null default now()
);

alter table retention_policy enable row level security;

grant select on retention_policy to authenticated;

drop policy if exists retention_policy_read on retention_policy;
create policy retention_policy_read on retention_policy
  for select to authenticated
  using (( select get_my_role() ) = 'admin');

insert into retention_policy (table_name, keep_days) values
  ('audit_log', 365),
  ('events_outbox', 7)
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
  n bigint;
begin
  select keep_days into audit_days from retention_policy where table_name = 'audit_log';
  select keep_days into outbox_days from retention_policy where table_name = 'events_outbox';

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
end;
$$;

revoke all on function public.fn_prune_retained_rows() from public;
grant execute on function public.fn_prune_retained_rows() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('foos-prune-retained')
      where exists (select 1 from cron.job where jobname = 'foos-prune-retained');
    perform cron.schedule('foos-prune-retained', '17 3 * * *', 'select public.fn_prune_retained_rows()');
  else
    raise notice 'pg_cron absent; call public.fn_prune_retained_rows() externally to enforce retention';
  end if;
end $$;
