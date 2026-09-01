-- ATS module tables.

create table candidate_profiles (
  person_id uuid primary key references people(id) on delete cascade,
  status_id uuid references candidate_statuses(id),
  star_grade smallint check (star_grade between 1 and 3),
  grade_comment text,
  current_title text,
  current_employer text,
  tenure_note text,
  salary_flag text,
  initial_date date,
  source_id uuid references sources(id),
  referred_by text,
  sourcer_id uuid references staff(id),
  do_not_contact boolean not null default false
);

create table requisitions (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('REQ'),
  job_code text,  -- keeps <Client>-<n>
  title text not null,
  description text,
  status requisition_status not null default 'draft',
  company_id uuid references companies(id) on delete cascade,
  location text,
  employment_type text,
  num_openings integer not null default 1,
  budget_status text,
  reason_for_opening text,
  replacement_for text,
  pay_min numeric,
  pay_max numeric,
  pay_currency text,
  pay_notes text,
  opened_date date,
  filled_date date,
  is_published boolean not null default false,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table requisition_owners (
  requisition_id uuid not null references requisitions(id) on delete cascade,
  staff_id uuid not null references staff(id),
  primary key (requisition_id, staff_id)
);

create table requisition_approvers (
  requisition_id uuid not null references requisitions(id) on delete cascade,
  staff_id uuid not null references staff(id),
  approver_type approver_type not null,
  decided_at timestamptz,
  decision text,
  primary key (requisition_id, staff_id, approver_type)
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('APP'),
  requisition_id uuid not null references requisitions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  stage application_stage not null default 'received',
  next_step text,
  rejection_reason text,
  is_shortlisted boolean not null default false,  -- Taleo "ACE"
  rank integer,
  source_id uuid references sources(id),
  answers jsonb not null default '{}',
  applied_at timestamptz not null default now(),
  hired_at timestamptz,
  stage_changed_at timestamptz not null default now(),
  unique (requisition_id, person_id)
);

create table application_views (
  application_id uuid not null references applications(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (application_id, staff_id)
);

create table intake_items (
  id uuid primary key default gen_random_uuid(),
  channel intake_channel not null,
  target_type intake_target_type not null,
  raw_payload jsonb not null default '{}',
  parsed jsonb not null default '{}',
  full_name text,
  linkedin_url text,
  batch_label text,
  submitted_by uuid references staff(id),
  star_grade smallint check (star_grade between 1 and 3),
  grade_comment text,
  status intake_status not null default 'pending',
  duplicate_of uuid references people(id) on delete set null,
  person_id uuid references people(id) on delete set null,  -- set on import
  created_at timestamptz not null default now()
);
