-- F23: fn_fire_due_reminders() is security definer and held PUBLIC EXECUTE, so
-- any signed-in user could flip every pending reminder in the table to 'fired',
-- including other people's. It bypassed the reminders_update policy entirely
-- because a security-definer function runs as its owner.
--
-- A plain revoke was not the answer. The sweep has two legitimate callers: the
-- pg_cron job and the outbox consumers, which run as service_role with no
-- auth.uid(); and a signed-in admin, which is how tests/e2e/reminders-tasks.spec.ts
-- drives the reminder.due event. So the function now guards on the caller and
-- narrows what it touches to exactly what the RLS policy on reminders would
-- have allowed that caller anyway:
--
--   no auth.uid()          -> service_role or pg_cron: sweep everything
--   get_my_role() = 'admin' -> sweep everything, matching reminders_update
--   any other staff row    -> sweep only rows where staff_id = auth.uid()
--   no staff row at all    -> refuse, because the caller is not staff
--
-- reminders_update is `get_my_role() = 'admin' OR staff_id = auth.uid()`, so
-- the definer rights now grant nothing the caller did not already hold. anon
-- loses EXECUTE outright: an unauthenticated request has no business firing
-- anybody's reminders.

create or replace function public.fn_fire_due_reminders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  fired integer;
  caller uuid := auth.uid();
  caller_role text;
  sweep_all boolean;
begin
  if caller is null then
    sweep_all := true;
  else
    select role into caller_role from staff where id = caller;
    if caller_role is null then
      raise exception 'fn_fire_due_reminders: caller % is not a staff member', caller
        using errcode = '42501';
    end if;
    sweep_all := caller_role = 'admin';
  end if;

  with due as (
    update reminders
       set status = 'fired'
     where status = 'pending'
       and remind_at <= now()
       and (sweep_all or staff_id = caller)
    returning id, staff_id, subject, remind_at, related_type, related_id
  )
  insert into events_outbox (event_name, aggregate_id, payload)
  select 'reminder.due', id, jsonb_build_object(
           'staff_id', staff_id, 'subject', subject, 'remind_at', remind_at,
           'related_type', related_type, 'related_id', related_id)
    from due;
  get diagnostics fired = row_count;
  return fired;
end $$;

revoke all on function public.fn_fire_due_reminders() from public, anon;
grant execute on function public.fn_fire_due_reminders() to authenticated, service_role;
