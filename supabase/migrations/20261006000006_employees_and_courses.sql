-- Employees, courses and course assignments, behind the Employees page's Onboard Employee
-- and Assign Course actions.
--
-- An employee is created by onboarding: status starts at 'onboarding' and moves to
-- 'active', 'offboarding' or 'inactive'. person_id optionally ties the employee to the
-- candidate or contact they came from; deleting that person keeps the employee row.
-- A course can be created from the assign dialog so assigning never dead-ends on an empty
-- catalogue. Assignments are unique per course and employee, and cascade with either side.
--
-- Every staff role can read all three tables, because the Employees, Onboard and Courses
-- tabs are shown to every role. Only admin and recruiter write, matching who onboards
-- placed candidates. display_code uses the same sequence-backed issuer as REQ/APP/DEAL/TKT,
-- so inserts leave it out.

create sequence if not exists public.emp_display_seq;
create sequence if not exists public.crs_display_seq;

create or replace function public.next_display_code(prefix text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := case prefix
    when 'REQ'  then nextval('public.req_display_seq')
    when 'APP'  then nextval('public.app_display_seq')
    when 'DEAL' then nextval('public.deal_display_seq')
    when 'TKT'  then nextval('public.tkt_display_seq')
    when 'EMP'  then nextval('public.emp_display_seq')
    when 'CRS'  then nextval('public.crs_display_seq')
    else null
  end;
  if n is null then
    raise exception 'unknown display code prefix: %', prefix;
  end if;
  return prefix || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('EMP'),
  person_id uuid references public.people(id) on delete set null,
  full_name text not null check (length(trim(full_name)) between 1 and 200),
  email text check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  job_title text,
  department text,
  location text,
  start_date date,
  manager_id uuid references public.staff(id) on delete set null,
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'offboarding', 'inactive')),
  is_test boolean not null default false,
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_status on public.employees (status);
create index if not exists idx_employees_person on public.employees (person_id);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  display_code text not null unique default public.next_display_code('CRS'),
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_courses_title on public.courses (lower(title));

create table if not exists public.course_assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'completed')),
  due_date date,
  completed_at timestamptz,
  assigned_by uuid references public.staff(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique (course_id, employee_id)
);

create index if not exists idx_course_assignments_employee on public.course_assignments (employee_id);

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at before update on public.employees
  for each row execute function public.fn_set_updated_at();

drop trigger if exists trg_courses_updated_at on public.courses;
create trigger trg_courses_updated_at before update on public.courses
  for each row execute function public.fn_set_updated_at();

alter table public.employees enable row level security;
alter table public.courses enable row level security;
alter table public.course_assignments enable row level security;

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using ((select public.get_my_role()) is not null);

drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter'))
  with check ((select public.get_my_role()) in ('admin', 'recruiter'));

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using ((select public.get_my_role()) is not null);

drop policy if exists courses_write on public.courses;
create policy courses_write on public.courses
  for all to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter'))
  with check ((select public.get_my_role()) in ('admin', 'recruiter'));

drop policy if exists course_assignments_select on public.course_assignments;
create policy course_assignments_select on public.course_assignments
  for select to authenticated
  using ((select public.get_my_role()) is not null);

drop policy if exists course_assignments_write on public.course_assignments;
create policy course_assignments_write on public.course_assignments
  for all to authenticated
  using ((select public.get_my_role()) in ('admin', 'recruiter'))
  with check ((select public.get_my_role()) in ('admin', 'recruiter'));

create or replace view public.employee_list
with (security_invoker = on) as
select
  e.id,
  e.display_code,
  e.person_id,
  e.full_name,
  e.email,
  e.job_title,
  e.department,
  e.location,
  e.start_date,
  e.status,
  e.manager_id,
  m.full_name as manager_name,
  e.updated_at,
  (select count(*) from public.course_assignments ca where ca.employee_id = e.id)::int as course_count,
  (select count(*) from public.course_assignments ca where ca.employee_id = e.id and ca.status <> 'completed')::int as open_course_count,
  lower(concat_ws(' ', e.display_code, e.full_name, e.email, e.job_title, e.department, e.location)) as search_text
from public.employees e
left join public.staff m on m.id = e.manager_id;

comment on view public.employee_list is
  'Employees with manager name and course counts, for server-side paging. security_invoker = on, so RLS on employees, staff and course_assignments decides visibility.';

create or replace view public.course_list
with (security_invoker = on) as
select
  c.id,
  c.display_code,
  c.title,
  c.description,
  c.status,
  c.updated_at,
  (select count(*) from public.course_assignments ca where ca.course_id = c.id)::int as assigned_count,
  (select count(*) from public.course_assignments ca where ca.course_id = c.id and ca.status = 'completed')::int as completed_count,
  lower(concat_ws(' ', c.display_code, c.title, c.description)) as search_text
from public.courses c;

comment on view public.course_list is
  'Courses with assignment and completion counts. security_invoker = on.';

grant select on public.employee_list, public.course_list to authenticated;
grant select, insert, update, delete on public.employees, public.courses, public.course_assignments to authenticated;
