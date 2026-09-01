-- Enforce the mandatory-reason rule in the database.
--
-- Acceptance criteria 2.8 ("rejection blocked without rejection_reason") and
-- 3.4 ("lost blocked without lost_reason") were enforced only in the React
-- forms. Verified against the local API on 2026-09-01: a signed-in admin could
-- PATCH stage='rejected' with rejection_reason null, and the same for deals,
-- and PostgREST accepted both. Any staff member holding the anon key, which
-- ships in the browser bundle by design, could do the same from a console. The
-- data-quality guarantee therefore did not hold.
--
-- Enforced on transition, not as a table CHECK, for the same reason
-- application.hired stays UPDATE-only (see 20260901000001): the Zoho Recruit
-- import will carry historically rejected applications and lost deals whose
-- reason was never recorded in the source system, and a CHECK constraint would
-- reject the whole import. An INSERT may therefore land in a terminal stage
-- without a reason; a user-driven transition into one may not.
--
-- Clearing the reason on a row already in the terminal stage is also blocked,
-- so the rule cannot be sidestepped in two steps.
--
-- Zero existing rows violate this at the time of writing (0 applications,
-- 0 deals), so no backfill is needed.

create or replace function public.fn_require_outcome_reason()
returns trigger
language plpgsql
as $function$
declare
  reason text;
  stage_now text;
  terminal text;
  col text;
begin
  if tg_table_name = 'applications' then
    terminal := 'rejected';
    col := 'rejection_reason';
    stage_now := new.stage::text;
    reason := new.rejection_reason;
    if stage_now = terminal
       and (old.stage::text is distinct from stage_now
            or old.rejection_reason is distinct from new.rejection_reason)
       and coalesce(btrim(reason), '') = '' then
      raise exception
        'A rejection reason is required to move an application to %. Set %.', terminal, col
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  terminal := 'lost';
  col := 'lost_reason';
  stage_now := new.stage::text;
  reason := new.lost_reason;
  if stage_now = terminal
     and (old.stage::text is distinct from stage_now
          or old.lost_reason is distinct from new.lost_reason)
     and coalesce(btrim(reason), '') = '' then
    raise exception
      'A lost reason is required to move a deal to %. Set %.', terminal, col
      using errcode = 'check_violation';
  end if;
  return new;
end $function$;

drop trigger if exists trg_applications_require_reason on public.applications;
create trigger trg_applications_require_reason
  before update on public.applications
  for each row execute function public.fn_require_outcome_reason();

drop trigger if exists trg_deals_require_reason on public.deals;
create trigger trg_deals_require_reason
  before update on public.deals
  for each row execute function public.fn_require_outcome_reason();
