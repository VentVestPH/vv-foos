-- Q4: email templates.
--
-- The transport is already built: gmail-send goes through the caller's own
-- Gmail. What was missing was not having to retype the same outreach, which is
-- also what acceptance criterion 6.5 assumes exists.
--
-- Templates are a team asset, so every signed-in staff member can read them and
-- admin or recruiter can change them. Placeholders are substituted in the
-- browser at send time, never stored expanded, so editing a template changes
-- every future send and no past one.

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_templates_name_len check (char_length(name) between 1 and 120),
  constraint email_templates_subject_len check (char_length(subject) between 1 and 300),
  constraint email_templates_body_len check (char_length(body) between 1 and 20000)
);

create unique index if not exists idx_email_templates_name on email_templates (lower(name));

drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at before update on email_templates
  for each row execute function public.fn_set_updated_at();

alter table email_templates enable row level security;

grant select, insert, update, delete on email_templates to authenticated;

drop policy if exists email_templates_read on email_templates;
create policy email_templates_read on email_templates
  for select to authenticated
  using (( select get_my_role() ) is not null);

drop policy if exists email_templates_write on email_templates;
create policy email_templates_write on email_templates
  for insert to authenticated
  with check (( select get_my_role() ) = any (array['admin', 'recruiter']));

drop policy if exists email_templates_update on email_templates;
create policy email_templates_update on email_templates
  for update to authenticated
  using (( select get_my_role() ) = any (array['admin', 'recruiter']))
  with check (( select get_my_role() ) = any (array['admin', 'recruiter']));

drop policy if exists email_templates_delete on email_templates;
create policy email_templates_delete on email_templates
  for delete to authenticated
  using (( select get_my_role() ) = any (array['admin', 'recruiter']));
