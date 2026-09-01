-- Criterion 5.10: careers_form intake rows are read-only.
--
-- The intake_items UPDATE policy lets a recruiter update any candidate-target
-- row whatever its channel, so verified against the local API on 2026-09-01 a
-- recruiter could rewrite full_name on a careers_form row and the change stuck.
-- Those rows are the applicant's own submission: they are the evidence of what
-- was sent, and the grading workflow has no reason to edit them.
--
-- Follows the column-guard pattern already used by fn_candidate_grade_guard,
-- which restricts a sourcer to star_grade and grade_comment: diff
-- to_jsonb(new) against to_jsonb(old) with the permitted columns removed.
--
-- The permitted set is the grading and routing workflow, everything a reviewer
-- legitimately does to an inbound application. The applicant-supplied fields
-- (channel, target_type, full_name, linkedin_url, raw_payload, parsed,
-- submitted_by, created_at) become immutable.
--
-- Admin is exempt, consistent with every other guard in this schema. That means
-- the criterion holds against recruiters and sourcers, not against an admin
-- correcting a bad row, which is the intended reading.

create or replace function public.fn_careers_form_intake_guard()
returns trigger
language plpgsql
as $function$
begin
  if old.channel <> 'careers_form' then
    return new;
  end if;
  if public.get_my_role() = 'admin' then
    return new;
  end if;
  if (to_jsonb(new) - 'status' - 'star_grade' - 'grade_comment' - 'person_id' - 'duplicate_of' - 'batch_label')
     is distinct from
     (to_jsonb(old) - 'status' - 'star_grade' - 'grade_comment' - 'person_id' - 'duplicate_of' - 'batch_label')
  then
    raise exception
      'careers_form intake rows are read-only: only status, star_grade, grade_comment, person_id, duplicate_of and batch_label may change'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $function$;

drop trigger if exists trg_intake_items_careers_form_guard on public.intake_items;

create trigger trg_intake_items_careers_form_guard
  before update on public.intake_items
  for each row execute function public.fn_careers_form_intake_guard();
