-- Shared core tables: staff, people, companies, lookups, audit_log, events_outbox.

-- staff.id equals auth.users.id by convention. No hard FK to auth.users so migrations
-- and seeds run on plain Postgres too; the signup hook keeps the two in step.
create table staff (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  role staff_role not null,
  title text,
  manager_id uuid references staff(id),
  is_active boolean not null default true
);

create table people (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  middle_name text,
  last_name text,
  headline text,
  emails jsonb not null default '[]',      -- [{type,address}]
  phones jsonb not null default '[]',      -- [{type,number}]
  city text,
  state text,
  postal_code text,
  country text,
  linkedin_public_url text,
  linkedin_recruiter_url text,
  online_resume_url text,
  other_urls jsonb not null default '[]',
  education jsonb not null default '[]',   -- [{degree,discipline,school,year}]
  is_test boolean not null default false,
  created_by uuid references staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  types text[] not null default '{}' check (types <@ array['client', 'employer', 'prospect']),
  website text,
  city text,
  state text,
  country text,
  phone text,
  owner_id uuid references staff(id),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- Admin-editable lookup. Values are never renamed in migrations; the full list
-- imports verbatim from Taleo's Main Status dropdown at Phase 4 migration.
create table candidate_statuses (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid,
  diff jsonb,
  at timestamptz not null default now()
);

create table events_outbox (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  aggregate_id uuid,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz  -- null = pending for the Edge Function consumer
);
