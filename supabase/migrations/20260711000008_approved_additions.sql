-- Gate 2 approved additions: ats_saved_views, intake_mapping_templates, integration_settings.

create table ats_saved_views (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  entity text not null,  -- e.g. 'requisitions', 'applications', 'people'
  name text not null,
  filters jsonb not null default '{}',
  columns jsonb not null default '[]',
  sort jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table intake_mapping_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_hint text,
  column_map jsonb not null default '{}',
  target_type text not null check (target_type in ('candidate', 'contact')),
  created_by uuid references staff(id),
  created_at timestamptz not null default now()
);

-- Agent 6 key/value store: staff-scoped sync cursors, label config, email
-- templates, unlink suppression list. staff_id null = global setting.
create table integration_settings (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff(id) on delete cascade,
  key text not null,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- One row per (staff, key); one global row per key.
create unique index uq_integration_settings_staff_key
  on integration_settings (staff_id, key) where staff_id is not null;
create unique index uq_integration_settings_global_key
  on integration_settings (key) where staff_id is null;
