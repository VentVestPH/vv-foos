-- CRM module tables.

create table contact_profiles (
  person_id uuid primary key references people(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  title text,
  is_primary boolean not null default false,
  since_date date
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('DEAL'),
  name text not null,
  company_id uuid references companies(id) on delete cascade,
  primary_contact_id uuid references people(id) on delete set null,
  owner_id uuid references staff(id),
  stage deal_stage not null default 'lead',
  value numeric,
  currency text,
  probability numeric,
  expected_close date,
  lost_reason text,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Schema ships now; the CS module builds later.
create table tickets (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('TKT'),
  subject text not null,
  company_id uuid references companies(id) on delete set null,
  person_id uuid references people(id) on delete set null,
  status ticket_status not null default 'new',
  priority text,
  sla_due_at timestamptz,
  resolved_at timestamptz,
  assignee_id uuid references staff(id)
);
