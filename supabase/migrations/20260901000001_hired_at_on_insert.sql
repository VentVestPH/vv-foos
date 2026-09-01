-- Set applications.hired_at when a row is INSERTed already at stage 'hired'.
--
-- DEFECT: fn_application_stage_before was BEFORE UPDATE only, so hired_at was
-- populated on a stage transition but left null on a direct insert at 'hired'.
-- dash._refresh_success_metrics derives the applications_hired metric from
-- `a.hired_at >= wk`, so such rows were permanently invisible to that metric.
-- This is the exact shape the Zoho Recruit importer will write: historical
-- hires arrive at their final stage, not by transition.
--
-- Domain events stay UPDATE-only on purpose. application.hired means "this
-- application just transitioned to hired" and drives the CRM contact-promotion
-- banner (HiredPromotionListener). Emitting it per row on a bulk historical
-- import would raise a promotion prompt for every past hire. An import that
-- wants those events should replay them explicitly, not acquire them as a side
-- effect of insert. Same reasoning for fn_log_status_change: an inserted row
-- has no previous status, so there is no transition to record.
--
-- stage_changed_at needs no insert branch; it already defaults to now().

create or replace function public.fn_application_stage_before()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    if new.stage = 'hired' and new.hired_at is null then
      new.hired_at := now();
    end if;
    return new;
  end if;

  if old.stage is distinct from new.stage then
    new.stage_changed_at := now();
    if new.stage = 'hired' and new.hired_at is null then
      new.hired_at := now();
    end if;
  end if;
  return new;
end $function$;

drop trigger if exists trg_applications_stage_before on public.applications;

create trigger trg_applications_stage_before
  before insert or update on public.applications
  for each row execute function public.fn_application_stage_before();
