-- Agent 5 — atomic import/reject for intake_items. intake_mapping_templates
-- and integration_settings already exist (Gate 2 approved additions,
-- 20260711000008); this migration adds only the transactional import/reject
-- functions the brief's business rules require ("Import is transactional:
-- person, profile, attachments, and the intake_items update succeed or roll
-- back together. No half-imported people.") Client-side multi-table writes
-- can't guarantee that, so the whole import happens in one plpgsql function.
--
-- Security definer, following the same pattern as Agent 1's trigger
-- functions (fn_emit_event, fn_audit, etc.): the function performs the
-- authorization check itself (mirroring the intake_items RLS policies)
-- rather than relying on per-table RLS, because some legitimate importers
-- (e.g. a sourcer importing their own graded candidate) aren't permitted to
-- insert candidate_profiles directly under the section 5 matrix — only the
-- intake_items row is theirs to act on, and this function is the sanctioned
-- path from "my graded intake item" to "a real candidate record."

create or replace function public.import_intake_item(
  p_intake_id uuid,
  p_mode text default 'new',              -- 'new' | 'merge'
  p_merge_person_id uuid default null,    -- required when p_mode = 'merge'
  p_company_id uuid default null,         -- contact path: explicit company choice
  p_new_company_name text default null    -- contact path: create-new-company override
)
returns jsonb
language plpgsql security definer set search_path = public
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
  linkedin text;
  v_status_id uuid;
  v_source_id uuid;
  v_company_id uuid;
  att jsonb;
begin
  if p_mode not in ('new', 'merge') then
    raise exception 'p_mode must be new or merge';
  end if;

  select * into it from intake_items where id = p_intake_id for update;
  if not found then
    raise exception 'intake item % not found', p_intake_id;
  end if;
  if it.channel = 'careers_form' then
    raise exception 'careers_form items auto-import and cannot be imported again';
  end if;
  if it.status = 'imported' then
    raise exception 'intake item already imported';
  end if;
  if it.status = 'rejected' then
    raise exception 'intake item was rejected; cannot import';
  end if;

  -- Authorization mirrors the intake_items RLS policies exactly (section 5).
  if not (
    actor_role = 'admin'
    or (actor_role = 'recruiter' and it.target_type = 'candidate')
    or (actor_role = 'sourcer' and it.target_type = 'candidate' and it.submitted_by = actor)
    or (actor_role = 'bd' and it.target_type = 'contact')
  ) then
    raise exception 'not authorized to import this intake item';
  end if;

  -- Grading gate (business rules): linkedin_url + candidate must be graded first.
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
  parsed_first := split_part(coalesce(parsed_name, ''), ' ', 1);
  parsed_last := nullif(trim(substr(coalesce(parsed_name, ''), length(parsed_first) + 1)), '');
  parsed_headline := it.parsed ->> 'headline';
  parsed_company := nullif(trim(coalesce(it.parsed ->> 'company', '')), '');
  parsed_title := it.parsed ->> 'title';
  linkedin := nullif(trim(coalesce(it.linkedin_url, it.parsed ->> 'linkedin_url', '')), '');
  email_addr := lower(trim(coalesce(
    it.parsed ->> 'email',
    it.parsed -> 'emails' ->> 0,
    ''
  )));
  if email_addr = '' then email_addr := null; end if;

  if p_mode = 'merge' then
    v_person_id := p_merge_person_id;
    -- Merge never overwrites a non-empty field (business rules).
    update people set
      first_name = coalesce(nullif(people.first_name, ''), parsed_first),
      last_name = coalesce(nullif(people.last_name, ''), parsed_last),
      headline = coalesce(nullif(people.headline, ''), parsed_headline),
      linkedin_public_url = coalesce(people.linkedin_public_url, linkedin),
      emails = case
        when jsonb_array_length(people.emails) = 0 and email_addr is not null
          then jsonb_build_array(jsonb_build_object('type', 'personal', 'address', email_addr))
        else people.emails
      end
    where people.id = v_person_id;
  else
    insert into people (first_name, last_name, headline, emails, linkedin_public_url, is_test, created_by)
    values (
      coalesce(nullif(parsed_first, ''), 'Unknown'),
      parsed_last,
      parsed_headline,
      case when email_addr is not null
        then jsonb_build_array(jsonb_build_object('type', 'personal', 'address', email_addr))
        else '[]'::jsonb
      end,
      linkedin,
      false,
      actor
    )
    returning id into v_person_id;
  end if;

  if it.target_type = 'candidate' then
    select id into v_source_id from sources where sources.name = case it.channel
      when 'linkedin_url' then 'LinkedIn'
      when 'email' then 'Email'
      when 'sheet_import' then 'Sheet import'
      else 'Other'
    end;
    select id into v_status_id from candidate_statuses where is_active order by sort_order asc limit 1;

    insert into candidate_profiles (
      person_id, status_id, star_grade, grade_comment,
      current_title, current_employer, initial_date, source_id, sourcer_id
    )
    values (
      v_person_id, v_status_id, it.star_grade, it.grade_comment,
      parsed_title, parsed_company, current_date, v_source_id,
      case when it.channel = 'linkedin_url' then it.submitted_by else null end
    )
    on conflict (person_id) do update set
      star_grade = coalesce(excluded.star_grade, candidate_profiles.star_grade),
      grade_comment = coalesce(excluded.grade_comment, candidate_profiles.grade_comment),
      current_title = coalesce(candidate_profiles.current_title, excluded.current_title),
      current_employer = coalesce(candidate_profiles.current_employer, excluded.current_employer);
  else
    if p_company_id is not null then
      v_company_id := p_company_id;
    elsif parsed_company is not null then
      select id into v_company_id from companies where lower(companies.name) = lower(parsed_company) limit 1;
      if v_company_id is null then
        insert into companies (name, types, owner_id)
        values (parsed_company, array['prospect'], actor)
        returning id into v_company_id;
      end if;
    elsif p_new_company_name is not null and trim(p_new_company_name) <> '' then
      insert into companies (name, types, owner_id)
      values (trim(p_new_company_name), array['prospect'], actor)
      returning id into v_company_id;
    end if;

    insert into contact_profiles (person_id, company_id, title)
    values (v_person_id, v_company_id, parsed_title)
    on conflict (person_id) do update set
      company_id = coalesce(contact_profiles.company_id, excluded.company_id),
      title = coalesce(contact_profiles.title, excluded.title);
  end if;

  -- Staged attachments (e.g. resumes captured by the email parser) land on
  -- the person now. Expected shape: parsed.attachments = [{storage_path,
  -- filename, kind}], written by whichever channel staged the file.
  if jsonb_typeof(it.parsed -> 'attachments') = 'array' then
    for att in select * from jsonb_array_elements(it.parsed -> 'attachments')
    loop
      insert into attachments (storage_path, parent_type, parent_id, kind, description, uploaded_by)
      values (
        att ->> 'storage_path',
        'person',
        v_person_id,
        coalesce(nullif(att ->> 'kind', ''), 'resume')::attachment_kind,
        'Staged via intake (' || it.channel || ')',
        it.submitted_by
      );
    end loop;
  end if;

  update intake_items set
    person_id = v_person_id,
    status = 'imported',
    duplicate_of = case when p_mode = 'merge' then p_merge_person_id else intake_items.duplicate_of end,
    parsed = case
      when p_mode = 'new' and it.duplicate_of is not null
        then jsonb_set(intake_items.parsed, '{dedup_override}', 'true'::jsonb, true)
      else intake_items.parsed
    end
  where intake_items.id = p_intake_id;

  return jsonb_build_object('person_id', v_person_id, 'mode', p_mode);
end;
$$;

create or replace function public.reject_intake_item(p_intake_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  it record;
  actor_role text := public.get_my_role();
  actor uuid := auth.uid();
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'a reject reason is required';
  end if;

  select * into it from intake_items where id = p_intake_id for update;
  if not found then
    raise exception 'intake item % not found', p_intake_id;
  end if;
  if it.channel = 'careers_form' then
    raise exception 'careers_form items cannot be rejected here';
  end if;
  if it.status = 'imported' then
    raise exception 'already imported; cannot reject';
  end if;

  if not (
    actor_role = 'admin'
    or (actor_role = 'recruiter' and it.target_type = 'candidate')
    or (actor_role = 'sourcer' and it.target_type = 'candidate' and it.submitted_by = actor)
    or (actor_role = 'bd' and it.target_type = 'contact')
  ) then
    raise exception 'not authorized to reject this intake item';
  end if;

  update intake_items set
    status = 'rejected',
    parsed = jsonb_set(parsed, '{reject_reason}', to_jsonb(trim(p_reason)), true)
  where id = p_intake_id;
end;
$$;

comment on function public.import_intake_item is
  'Agent 5: atomic candidate/contact import from an intake_items row. Security definer so a sourcer can import their own graded candidate despite having no direct INSERT grant on candidate_profiles — the function re-checks authorization internally against the same rules as the intake_items RLS policies.';
comment on function public.reject_intake_item is
  'Agent 5: reject an intake_items row with a required reason. Rows stay queryable for source-effectiveness analysis; nothing is deleted.';
