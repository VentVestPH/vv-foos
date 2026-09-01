-- Extensions. pgcrypto for gen_random_uuid(); pg_cron only where the host preloads it (Supabase does).
create extension if not exists pgcrypto;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron;
    exception when others then
      raise notice 'pg_cron available but could not be created (not preloaded?); reminder.due job must be scheduled manually';
    end;
  else
    raise notice 'pg_cron not available on this host; reminder.due fires via manual calls to fn_fire_due_reminders()';
  end if;
end $$;
