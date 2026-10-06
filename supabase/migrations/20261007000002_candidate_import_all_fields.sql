-- FOOS-8: a candidate sheet import carries every field on the candidate record.
--
-- The ticket's screenshots show the candidate record's Name, Contact, Location, Profiles,
-- Assessment scores and Grading and salary groups, plus the requisition and main status.
-- 20261007000001 already wrote names, email, phone, country, salary, status, education,
-- experience and the requisition. This adds the rest: middle name, a work email beside the
-- personal one, street, city, a ZI/Twitter URL (people.other_urls), the initial date and the
-- four assessment scores. Star grade and grade comment travel on the intake item itself.
--
-- A candidate's primary email is now stored as type 'personal', which is what 72,169 of
-- the 73,925 imported addresses already are; a contact's stays 'work'. A missing email no
-- longer writes an address of null into a contact's emails array.
--
-- The body is 20261007000001's function with those fields added; the checks are unchanged.

create or replace function public.import_intake_item(
  p_intake_id uuid,
  p_mode text default 'new',
  p_merge_person_id uuid default null,
  p_company_id uuid default null,
  p_new_company_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it record;
  actor_role text := public.get_my_role();
  actor uuid := auth.uid();
  v_person_id uuid;
  parsed_name text;
  parsed_first text;
  parsed_last text;
  parsed_headline text;
  parsed_company text;
  parsed_title text;
  email_addr text;
  phone_number text;
  linkedin text;
  country_name text;
  parsed_middle text;
  work_email_addr text;
  street_addr text;
  city_name text;
  twitter text;
  v_emails jsonb;
  v_initial_date date;
  v_scores jsonb := '{}'::jsonb;
  v_status_id uuid;
  v_source_id uuid;
  v_company_id uuid;
  v_requisition_id uuid;
  v_expected_salary numeric;
  v_current_salary numeric;
  att jsonb;
begin
  if p_mode not in ('new', 'merge') then
    raise exception 'p_mode must be new or merge';
  end if;

  select * into it from public.intake_items where id = p_intake_id for update;
  if not found then raise exception 'intake item % not found', p_intake_id; end if;
  if it.channel = 'careers_form' then raise exception 'careers_form items auto-import and cannot be imported again'; end if;
  if it.status = 'imported' then raise exception 'intake item already imported'; end if;
  if it.status = 'rejected' then raise exception 'intake item was rejected; cannot import'; end if;

  if not (
    actor_role = 'admin'
    or (actor_role = 'recruiter' and it.target_type = 'candidate')
    or (actor_role = 'sourcer' and it.target_type = 'candidate' and it.submitted_by = actor)
    or (actor_role = 'bd' and it.target_type = 'contact')
  ) then raise exception 'not authorized to import this intake item'; end if;

  if it.target_type = 'candidate' and it.channel = 'linkedin_url' and it.status <> 'graded' then
    raise exception 'candidate must be graded before import on the linkedin_url channel';
  end if;
  if it.target_type = 'candidate' and it.star_grade is not null and it.grade_comment is null then
    raise exception 'grade_comment is required whenever star_grade is set';
  end if;
  if p_mode = 'merge' and p_merge_person_id is null then
    raise exception 'merge mode requires p_merge_person_id';
  end if;

  parsed_name := nullif(trim(coalesce(it.full_name, it.parsed ->> 'name')), '');
  parsed_first := nullif(trim(coalesce(it.parsed ->> 'first_name', split_part(coalesce(parsed_name, ''), ' ', 1))), '');
  parsed_last := nullif(trim(coalesce(
    it.parsed ->> 'last_name',
    nullif(trim(substr(coalesce(parsed_name, ''), length(split_part(coalesce(parsed_name, ''), ' ', 1)) + 1)), '')
  )), '');
  parsed_headline := nullif(trim(it.parsed ->> 'headline'), '');
  parsed_company := nullif(trim(coalesce(it.parsed ->> 'company', it.parsed ->> 'current_employer', '')), '');
  parsed_title := nullif(trim(coalesce(it.parsed ->> 'title', it.parsed ->> 'current_title', '')), '');
  linkedin := nullif(trim(coalesce(it.linkedin_url, it.parsed ->> 'linkedin_url', '')), '');
  email_addr := nullif(lower(trim(coalesce(it.parsed ->> 'email', it.parsed -> 'emails' ->> 0, ''))), '');
  phone_number := nullif(trim(coalesce(it.parsed ->> 'phone', '')), '');
  country_name := nullif(trim(coalesce(it.parsed ->> 'country', '')), '');
  parsed_middle := nullif(trim(coalesce(it.parsed ->> 'middle_name', '')), '');
  work_email_addr := nullif(lower(trim(coalesce(it.parsed ->> 'work_email', ''))), '');
  street_addr := nullif(trim(coalesce(it.parsed ->> 'street', '')), '');
  city_name := nullif(trim(coalesce(it.parsed ->> 'city', '')), '');
  twitter := nullif(trim(coalesce(it.parsed ->> 'twitter_url', '')), '');
  if jsonb_typeof(it.parsed -> 'assessment_scores') = 'object' then
    v_scores := it.parsed -> 'assessment_scores';
  end if;

  if it.target_type = 'candidate' then
    if parsed_first is null then raise exception 'First name is required before importing a candidate'; end if;
    if parsed_last is null then raise exception 'Last name is required before importing a candidate'; end if;
    if email_addr is null or email_addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'A valid email address is required before importing a candidate';
    end if;
    if phone_number is not null and phone_number !~ '^\+?[0-9][0-9 (),-]*$' then
      raise exception 'Phone can contain numbers, spaces, parentheses, dashes, and commas only';
    end if;
    if work_email_addr is not null and work_email_addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'The work email address is not valid';
    end if;
    if nullif(trim(it.parsed ->> 'initial_date'), '') is not null then
      begin
        v_initial_date := (it.parsed ->> 'initial_date')::date;
      exception when others then
        raise exception 'Initial date must be written YYYY-MM-DD';
      end;
    end if;

    if nullif(it.parsed ->> 'expected_salary', '') is not null then
      if (it.parsed ->> 'expected_salary') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Expected salary must be numeric'; end if;
      v_expected_salary := (it.parsed ->> 'expected_salary')::numeric;
    end if;
    if nullif(it.parsed ->> 'current_salary', '') is not null then
      if (it.parsed ->> 'current_salary') !~ '^[0-9]+(\.[0-9]+)?$' then raise exception 'Current salary must be numeric'; end if;
      v_current_salary := (it.parsed ->> 'current_salary')::numeric;
    end if;

    if nullif(it.parsed ->> 'status', '') is not null then
      select id into v_status_id from public.candidate_statuses
      where is_active and lower(label) = lower(trim(it.parsed ->> 'status'));
      if v_status_id is null then raise exception 'Unknown active candidate status: %', it.parsed ->> 'status'; end if;
    else
      select id into v_status_id from public.candidate_statuses
      where is_active
      order by (label = 'Talent Pool') desc, sort_order
      limit 1;
    end if;

    if nullif(it.parsed ->> 'requisition_id', '') is not null then
      if actor_role not in ('admin', 'recruiter') then
        raise exception 'only an admin or recruiter can import candidates attached to a requisition';
      end if;
      begin
        v_requisition_id := (it.parsed ->> 'requisition_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'Selected requisition is invalid';
      end;
      if not exists (
        select 1 from public.requisitions
        where id = v_requisition_id
          and status in ('open', 'waiting_approval', 'on_hold')
      ) then
        raise exception 'Selected requisition is no longer available';
      end if;
    end if;

    if v_requisition_id is null and actor_role in ('admin', 'recruiter') then
      raise exception 'Attach the candidate to a requisition before importing';
    end if;
  end if;

  v_emails := case when email_addr is null then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object(
      'type', case when it.target_type = 'candidate' then 'personal' else 'work' end,
      'address', email_addr)) end
    || case when work_email_addr is null or work_email_addr = email_addr then '[]'::jsonb
    else jsonb_build_array(jsonb_build_object('type', 'work', 'address', work_email_addr)) end;

  if p_mode = 'merge' then
    v_person_id := p_merge_person_id;
    update public.people set
      first_name = coalesce(nullif(public.people.first_name, ''), parsed_first),
      middle_name = coalesce(nullif(public.people.middle_name, ''), parsed_middle),
      street = coalesce(nullif(public.people.street, ''), street_addr),
      city = coalesce(nullif(public.people.city, ''), city_name),
      other_urls = case when jsonb_array_length(public.people.other_urls) = 0 and twitter is not null
        then jsonb_build_array(twitter) else public.people.other_urls end,
      last_name = coalesce(nullif(public.people.last_name, ''), parsed_last),
      headline = coalesce(nullif(public.people.headline, ''), parsed_headline),
      linkedin_public_url = coalesce(public.people.linkedin_public_url, linkedin),
      country = coalesce(public.people.country, country_name),
      phones = case when jsonb_array_length(public.people.phones) = 0 and phone_number is not null
        then jsonb_build_array(jsonb_build_object('type', 'work', 'number', phone_number)) else public.people.phones end,
      education = case when jsonb_array_length(public.people.education) = 0 and jsonb_typeof(it.parsed -> 'education') = 'array'
        then it.parsed -> 'education' else public.people.education end,
      experience = case when jsonb_array_length(public.people.experience) = 0 and jsonb_typeof(it.parsed -> 'experience') = 'array'
        then it.parsed -> 'experience' else public.people.experience end,
      emails = case when jsonb_array_length(public.people.emails) = 0 then v_emails else public.people.emails end
    where public.people.id = v_person_id;
  else
    insert into public.people (
      first_name, middle_name, last_name, headline, emails, phones, street, city, country,
      linkedin_public_url, other_urls, education, experience, is_test, created_by
    ) values (
      parsed_first, parsed_middle, parsed_last, parsed_headline,
      v_emails,
      case when phone_number is null then '[]'::jsonb else jsonb_build_array(jsonb_build_object('type', 'work', 'number', phone_number)) end,
      street_addr, city_name, country_name, linkedin,
      case when twitter is null then '[]'::jsonb else jsonb_build_array(twitter) end,
      case when jsonb_typeof(it.parsed -> 'education') = 'array' then it.parsed -> 'education' else '[]'::jsonb end,
      case when jsonb_typeof(it.parsed -> 'experience') = 'array' then it.parsed -> 'experience' else '[]'::jsonb end,
      false, actor
    ) returning id into v_person_id;
  end if;

  if it.target_type = 'candidate' then
    select id into v_source_id from public.sources where name = case it.channel
      when 'linkedin_url' then 'LinkedIn' when 'email' then 'Email'
      when 'sheet_import' then 'Sheet import' else 'Other' end;

    insert into public.candidate_profiles (
      person_id, status_id, star_grade, grade_comment, current_title, current_employer,
      tenure_note, salary_flag, expected_salary, current_salary, salary_currency,
      initial_date, source_id, sourcer_id, assessment_scores
    ) values (
      v_person_id, v_status_id, it.star_grade, it.grade_comment, parsed_title, parsed_company,
      nullif(trim(it.parsed ->> 'tenure_note'), ''), nullif(trim(it.parsed ->> 'salary_flag'), ''),
      v_expected_salary, v_current_salary, nullif(trim(it.parsed ->> 'salary_currency'), ''),
      coalesce(v_initial_date, current_date), v_source_id,
      case when it.channel = 'linkedin_url' then it.submitted_by else null end, v_scores
    ) on conflict (person_id) do update set
      initial_date = coalesce(candidate_profiles.initial_date, excluded.initial_date),
      assessment_scores = case when candidate_profiles.assessment_scores = '{}'::jsonb
        then excluded.assessment_scores else candidate_profiles.assessment_scores end,
      star_grade = coalesce(excluded.star_grade, candidate_profiles.star_grade),
      grade_comment = coalesce(excluded.grade_comment, candidate_profiles.grade_comment),
      current_title = coalesce(candidate_profiles.current_title, excluded.current_title),
      current_employer = coalesce(candidate_profiles.current_employer, excluded.current_employer),
      tenure_note = coalesce(candidate_profiles.tenure_note, excluded.tenure_note),
      salary_flag = coalesce(candidate_profiles.salary_flag, excluded.salary_flag),
      expected_salary = coalesce(candidate_profiles.expected_salary, excluded.expected_salary),
      current_salary = coalesce(candidate_profiles.current_salary, excluded.current_salary),
      salary_currency = coalesce(candidate_profiles.salary_currency, excluded.salary_currency);

    if v_requisition_id is not null then
      insert into public.applications (requisition_id, person_id, source_id)
      values (v_requisition_id, v_person_id, v_source_id)
      on conflict (requisition_id, person_id) do nothing;
    end if;
  else
    if p_company_id is not null then
      v_company_id := p_company_id;
    elsif parsed_company is not null then
      select id into v_company_id from public.companies where lower(name) = lower(parsed_company) limit 1;
      if v_company_id is null then
        insert into public.companies (name, types, owner_id) values (parsed_company, array['prospect'], actor) returning id into v_company_id;
      end if;
    elsif p_new_company_name is not null and trim(p_new_company_name) <> '' then
      insert into public.companies (name, types, owner_id) values (trim(p_new_company_name), array['prospect'], actor) returning id into v_company_id;
    end if;

    insert into public.contact_profiles (person_id, company_id, title)
    values (v_person_id, v_company_id, parsed_title)
    on conflict (person_id) do update set
      company_id = coalesce(contact_profiles.company_id, excluded.company_id),
      title = coalesce(contact_profiles.title, excluded.title);
  end if;

  if jsonb_typeof(it.parsed -> 'attachments') = 'array' then
    for att in select * from jsonb_array_elements(it.parsed -> 'attachments') loop
      insert into public.attachments (storage_path, parent_type, parent_id, kind, description, uploaded_by)
      values (att ->> 'storage_path', 'person', v_person_id,
        coalesce(nullif(att ->> 'kind', ''), 'resume')::attachment_kind,
        'Staged via intake (' || it.channel || ')', it.submitted_by);
    end loop;
  end if;

  update public.intake_items set
    person_id = v_person_id,
    status = 'imported',
    duplicate_of = case when p_mode = 'merge' then p_merge_person_id else duplicate_of end,
    parsed = case when p_mode = 'new' and it.duplicate_of is not null
      then jsonb_set(parsed, '{dedup_override}', 'true'::jsonb, true) else parsed end
  where id = p_intake_id;

  return jsonb_build_object('person_id', v_person_id, 'mode', p_mode, 'requisition_id', v_requisition_id);
end;
$$;

comment on function public.import_intake_item(uuid, text, uuid, uuid, text) is
  'Atomically imports an intake item, candidate profile fields, optional education/experience, and the requisition application an admin or recruiter must attach.';
