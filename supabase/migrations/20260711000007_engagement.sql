-- Engagement tables: activities, tasks, reminders, attachments.
-- Created after ATS/CRM so activity FKs resolve. Polymorphic links on
-- tasks/reminders/attachments use (type, id) pairs, no FK.

create table activities (
  id uuid primary key default gen_random_uuid(),
  kind activity_kind not null,
  subject text,
  body text,
  occurred_at timestamptz not null default now(),
  person_id uuid references people(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  requisition_id uuid references requisitions(id) on delete cascade,
  gmail_message_id text,
  gcal_event_id text,
  attendees jsonb,  -- calendar-sourced meetings
  created_by uuid references staff(id)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  due_date date,
  priority text,
  status text not null default 'open',
  assignee_id uuid references staff(id),
  related_type text,  -- person|company|requisition|application|deal|ticket
  related_id uuid
);

create table reminders (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id),
  subject text not null,
  remind_at timestamptz not null,
  related_type text,
  related_id uuid,
  status reminder_status not null default 'pending'
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,  -- path in the 'attachments' Storage bucket
  parent_type text not null,   -- person|company|requisition|application|deal|ticket
  parent_id uuid not null,
  kind attachment_kind not null default 'other',
  description text,
  uploaded_by uuid references staff(id),
  uploaded_at timestamptz not null default now()
);
