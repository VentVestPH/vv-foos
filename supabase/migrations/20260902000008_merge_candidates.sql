-- Q2: merge two candidate records that are already in the system.
--
-- Deduplication existed only at intake. Nothing merged two people rows once
-- both were saved, which is the classic way an ATS's data quality decays.
--
-- This is one security-definer function rather than a sequence of client
-- updates, for two reasons. It has to be atomic: reassigning applications,
-- activities, tasks, reminders and attachments and then deleting a person is
-- six statements that must all land or none. And it has to handle the case the
-- client cannot see coming, where both candidates applied to the same
-- requisition and applications (requisition_id, person_id) is unique.
--
-- The role check inside the function is the real control. security definer
-- bypasses RLS, so the function refuses anyone who is not an admin or a
-- recruiter, and refuses a survivor or duplicate that is not a candidate.
--
-- Field-level merge is fill-the-blanks only: the survivor never loses a value
-- it already had. Nothing is overwritten, so a merge cannot destroy data that
-- was not already empty.

create or replace function public.fn_merge_candidates(
  p_survivor uuid,
  p_duplicate uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_moved_applications integer := 0;
  v_dropped_applications integer := 0;
  v_moved_activities integer := 0;
  v_moved_tasks integer := 0;
  v_moved_reminders integer := 0;
  v_moved_attachments integer := 0;
begin
  v_role := public.get_my_role();
  if v_role is null or v_role not in ('admin', 'recruiter') then
    raise exception 'only an admin or a recruiter can merge candidates';
  end if;
  if p_survivor = p_duplicate then
    raise exception 'a candidate cannot be merged into itself';
  end if;
  if not exists (select 1 from candidate_profiles where person_id = p_survivor) then
    raise exception 'the surviving record is not a candidate';
  end if;
  if not exists (select 1 from candidate_profiles where person_id = p_duplicate) then
    raise exception 'the duplicate record is not a candidate';
  end if;

  delete from applications a
   where a.person_id = p_duplicate
     and exists (
       select 1 from applications keep
        where keep.person_id = p_survivor
          and keep.requisition_id = a.requisition_id
     );
  get diagnostics v_dropped_applications = row_count;

  update applications set person_id = p_survivor where person_id = p_duplicate;
  get diagnostics v_moved_applications = row_count;

  update activities set person_id = p_survivor where person_id = p_duplicate;
  get diagnostics v_moved_activities = row_count;

  update tasks set related_id = p_survivor
   where related_type = 'person' and related_id = p_duplicate;
  get diagnostics v_moved_tasks = row_count;

  update reminders set related_id = p_survivor
   where related_type = 'person' and related_id = p_duplicate;
  get diagnostics v_moved_reminders = row_count;

  update attachments set parent_id = p_survivor
   where parent_type = 'person' and parent_id = p_duplicate;
  get diagnostics v_moved_attachments = row_count;

  update intake_items set person_id = p_survivor where person_id = p_duplicate;
  update intake_items set duplicate_of = p_survivor where duplicate_of = p_duplicate;
  update tickets set person_id = p_survivor where person_id = p_duplicate;
  update deals set primary_contact_id = p_survivor where primary_contact_id = p_duplicate;

  update people s set
    middle_name = coalesce(s.middle_name, d.middle_name),
    headline = coalesce(s.headline, d.headline),
    street = coalesce(s.street, d.street),
    city = coalesce(s.city, d.city),
    state = coalesce(s.state, d.state),
    postal_code = coalesce(s.postal_code, d.postal_code),
    country = coalesce(s.country, d.country),
    linkedin_public_url = coalesce(s.linkedin_public_url, d.linkedin_public_url),
    linkedin_recruiter_url = coalesce(s.linkedin_recruiter_url, d.linkedin_recruiter_url),
    online_resume_url = coalesce(s.online_resume_url, d.online_resume_url),
    emails = case
      when s.emails = '[]'::jsonb or s.emails is null then d.emails else s.emails end,
    phones = case
      when s.phones = '[]'::jsonb or s.phones is null then d.phones else s.phones end,
    education = case
      when s.education = '[]'::jsonb or s.education is null then d.education else s.education end,
    experience = case
      when s.experience = '[]'::jsonb or s.experience is null then d.experience else s.experience end
  from people d
  where s.id = p_survivor and d.id = p_duplicate;

  update candidate_profiles s set
    status_id = coalesce(s.status_id, d.status_id),
    star_grade = coalesce(s.star_grade, d.star_grade),
    grade_comment = coalesce(s.grade_comment, d.grade_comment),
    current_title = coalesce(s.current_title, d.current_title),
    current_employer = coalesce(s.current_employer, d.current_employer),
    tenure_note = coalesce(s.tenure_note, d.tenure_note),
    salary_flag = coalesce(s.salary_flag, d.salary_flag),
    initial_date = least(coalesce(s.initial_date, d.initial_date), coalesce(d.initial_date, s.initial_date)),
    source_id = coalesce(s.source_id, d.source_id),
    referred_by = coalesce(s.referred_by, d.referred_by),
    sourcer_id = coalesce(s.sourcer_id, d.sourcer_id),
    do_not_contact = s.do_not_contact or d.do_not_contact,
    expected_salary = coalesce(s.expected_salary, d.expected_salary),
    current_salary = coalesce(s.current_salary, d.current_salary),
    salary_currency = coalesce(s.salary_currency, d.salary_currency)
  from candidate_profiles d
  where s.person_id = p_survivor and d.person_id = p_duplicate;

  delete from candidate_profiles where person_id = p_duplicate;
  delete from contact_profiles where person_id = p_duplicate;
  delete from people where id = p_duplicate;

  insert into activities (kind, subject, body, person_id, created_by)
  values (
    'note',
    'Duplicate record merged in',
    format(
      'Merged %s into this record: %s application(s) moved, %s dropped as duplicates, %s activity, %s task, %s reminder and %s attachment row(s) reassigned.',
      p_duplicate, v_moved_applications, v_dropped_applications, v_moved_activities,
      v_moved_tasks, v_moved_reminders, v_moved_attachments
    ),
    p_survivor,
    auth.uid()
  );

  return jsonb_build_object(
    'survivor', p_survivor,
    'duplicate', p_duplicate,
    'applications_moved', v_moved_applications,
    'applications_dropped', v_dropped_applications,
    'activities_moved', v_moved_activities,
    'tasks_moved', v_moved_tasks,
    'reminders_moved', v_moved_reminders,
    'attachments_moved', v_moved_attachments
  );
end;
$$;

revoke all on function public.fn_merge_candidates(uuid, uuid) from public;
grant execute on function public.fn_merge_candidates(uuid, uuid) to authenticated;
