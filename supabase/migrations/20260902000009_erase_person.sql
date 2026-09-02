-- Candidate data retention and an erasure path.
--
-- A candidate can ask to be removed. Deleting the person row alone is not an
-- answer: applications, activities and attachments reference them, the files
-- live in Storage where SQL cannot reach, and an audit trail has to survive or
-- the deletion itself becomes unauditable.
--
-- So erasure is in two halves, deliberately.
--
-- fn_erase_person does the database half in one transaction: it removes the
-- candidate and contact profiles, the applications, the activities, the tasks
-- and reminders, the intake rows, and finally the person, and it queues every
-- attachment path for the file sweep. It is admin-only, checked inside the
-- function because security definer bypasses RLS.
--
-- The Storage half is scripts/purge-orphan-attachments.mjs, which already
-- exists: deleting the attachments row queues the path in
-- attachment_deletion_queue via the trigger from 20260901000009, and the script
-- drains that queue. Erasure is therefore not complete until that runs, which
-- is why the function reports how many files it queued.
--
-- What survives on purpose: audit_log rows, which name the table and the record
-- id but hold no candidate content, and the erasure receipt below. A receipt is
-- what lets anyone answer "was this person erased, and when" without keeping
-- the person.
--
-- erasure_log is granted SELECT and nothing else, to nobody but an admin. There
-- is deliberately no way to delete a receipt through the API, including for an
-- admin, because a deletable receipt is not evidence. Retention prunes them
-- after ten years.

create table if not exists erasure_log (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null,
  erased_by uuid not null,
  erased_at timestamptz not null default now(),
  reason text,
  counts jsonb not null default '{}'
);

alter table erasure_log enable row level security;

grant select on erasure_log to authenticated;

drop policy if exists erasure_log_read on erasure_log;
create policy erasure_log_read on erasure_log
  for select to authenticated
  using (( select get_my_role() ) = 'admin');

create or replace function public.fn_erase_person(
  p_person uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_counts jsonb;
  v_applications integer := 0;
  v_activities integer := 0;
  v_attachments integer := 0;
  v_tasks integer := 0;
  v_reminders integer := 0;
begin
  if public.get_my_role() is distinct from 'admin' then
    raise exception 'only an admin can erase a person';
  end if;
  if not exists (select 1 from people where id = p_person) then
    raise exception 'no such person';
  end if;

  delete from attachments where parent_type = 'person' and parent_id = p_person;
  get diagnostics v_attachments = row_count;

  delete from applications where person_id = p_person;
  get diagnostics v_applications = row_count;

  delete from activities where person_id = p_person;
  get diagnostics v_activities = row_count;

  delete from tasks where related_type = 'person' and related_id = p_person;
  get diagnostics v_tasks = row_count;

  delete from reminders where related_type = 'person' and related_id = p_person;
  get diagnostics v_reminders = row_count;

  update tickets set person_id = null where person_id = p_person;
  update deals set primary_contact_id = null where primary_contact_id = p_person;
  delete from intake_items where person_id = p_person or duplicate_of = p_person;
  delete from candidate_profiles where person_id = p_person;
  delete from contact_profiles where person_id = p_person;
  delete from people where id = p_person;

  v_counts := jsonb_build_object(
    'applications', v_applications,
    'activities', v_activities,
    'attachments_queued', v_attachments,
    'tasks', v_tasks,
    'reminders', v_reminders
  );

  insert into erasure_log (person_id, erased_by, reason, counts)
  values (p_person, auth.uid(), p_reason, v_counts);

  return v_counts || jsonb_build_object('person_id', p_person, 'files_still_to_purge', v_attachments);
end;
$$;

revoke all on function public.fn_erase_person(uuid, text) from public;
grant execute on function public.fn_erase_person(uuid, text) to authenticated;

insert into retention_policy (table_name, keep_days) values ('erasure_log', 3650)
on conflict (table_name) do nothing;
