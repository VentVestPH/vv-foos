-- Synthetic employees, courses and course assignments for the isolated FOOS local stack.
-- Staff ids are the four seeded test personas. Re-running updates the same rows.
insert into public.courses (id, title, description, status) values
  ('e1000000-0000-4000-8000-000000000001', 'Company Orientation', 'Who we are, how we work, and where to find help.', 'active'),
  ('e1000000-0000-4000-8000-000000000002', 'Data Privacy Essentials', 'Handling candidate and client personal data under the Data Privacy Act.', 'active'),
  ('e1000000-0000-4000-8000-000000000003', 'Recruiting Fundamentals', 'Sourcing, screening and submitting candidates the VentVest way.', 'active'),
  ('e1000000-0000-4000-8000-000000000004', 'Client Communication', 'Writing updates, handling feedback and escalating issues.', 'active'),
  ('e1000000-0000-4000-8000-000000000005', 'Workplace Safety', 'Office safety, emergency procedures and incident reporting.', 'active'),
  ('e1000000-0000-4000-8000-000000000006', 'Offboarding Handover', 'Handing over accounts, files and open work before leaving.', 'active'),
  ('e1000000-0000-4000-8000-000000000007', 'Legacy ATS Training', 'Retired course kept for completion history.', 'archived')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  status = excluded.status;

insert into public.employees (id, full_name, email, job_title, department, location, start_date, manager_id, status, is_test) values
  ('e2000000-0000-4000-8000-000000000001', 'Andrea Villanueva', 'andrea.villanueva@ventvest.example', 'Senior Recruiter', 'Recruitment', 'Makati', '2024-02-05', 'a0000000-0000-4000-8000-000000000005', 'active', true),
  ('e2000000-0000-4000-8000-000000000002', 'Paolo Mendoza', 'paolo.mendoza@ventvest.example', 'Talent Sourcer', 'Recruitment', 'Makati', '2024-08-19', 'a0000000-0000-4000-8000-000000000002', 'active', true),
  ('e2000000-0000-4000-8000-000000000003', 'Bea Santos', 'bea.santos@ventvest.example', 'Account Manager', 'Business Development', 'Cebu', '2023-11-13', 'a0000000-0000-4000-8000-000000000004', 'active', true),
  ('e2000000-0000-4000-8000-000000000004', 'Miguel Reyes', 'miguel.reyes@ventvest.example', 'Operations Analyst', 'Operations', 'Remote', '2025-01-06', 'a0000000-0000-4000-8000-000000000005', 'active', true),
  ('e2000000-0000-4000-8000-000000000005', 'Camille Tan', 'camille.tan@ventvest.example', 'HR Generalist', 'People', 'Makati', '2025-06-02', 'a0000000-0000-4000-8000-000000000005', 'active', true),
  ('e2000000-0000-4000-8000-000000000006', 'Joshua Lim', 'joshua.lim@ventvest.example', 'Recruiter', 'Recruitment', 'Makati', '2026-10-13', 'a0000000-0000-4000-8000-000000000002', 'onboarding', true),
  ('e2000000-0000-4000-8000-000000000007', 'Patricia Gomez', 'patricia.gomez@ventvest.example', 'Sourcing Specialist', 'Recruitment', 'Remote', '2026-10-20', 'a0000000-0000-4000-8000-000000000003', 'onboarding', true),
  ('e2000000-0000-4000-8000-000000000008', 'Rafael Cruz', 'rafael.cruz@ventvest.example', 'Business Development Associate', 'Business Development', 'Cebu', '2026-11-03', 'a0000000-0000-4000-8000-000000000004', 'onboarding', true),
  ('e2000000-0000-4000-8000-000000000009', 'Nicole Aquino', 'nicole.aquino@ventvest.example', 'Payroll Officer', 'Finance', 'Makati', '2026-10-27', 'a0000000-0000-4000-8000-000000000005', 'onboarding', true),
  ('e2000000-0000-4000-8000-000000000010', 'Daniel Ong', 'daniel.ong@ventvest.example', 'Recruiter', 'Recruitment', 'Makati', '2022-04-11', 'a0000000-0000-4000-8000-000000000002', 'offboarding', true),
  ('e2000000-0000-4000-8000-000000000011', 'Hannah Garcia', 'hannah.garcia@ventvest.example', 'Account Executive', 'Business Development', 'Remote', '2023-03-20', 'a0000000-0000-4000-8000-000000000004', 'offboarding', true),
  ('e2000000-0000-4000-8000-000000000012', 'Carlo Bautista', 'carlo.bautista@ventvest.example', 'IT Support', 'Operations', 'Makati', '2021-09-01', 'a0000000-0000-4000-8000-000000000005', 'offboarding', true),
  ('e2000000-0000-4000-8000-000000000013', 'Lea Navarro', 'lea.navarro@ventvest.example', 'Junior Recruiter', 'Recruitment', 'Makati', '2022-01-17', 'a0000000-0000-4000-8000-000000000002', 'inactive', true)
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  job_title = excluded.job_title,
  department = excluded.department,
  location = excluded.location,
  start_date = excluded.start_date,
  manager_id = excluded.manager_id,
  status = excluded.status,
  is_test = excluded.is_test;

insert into public.course_assignments (course_id, employee_id, status, due_date, completed_at, assigned_by) values
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'completed', '2024-02-16', '2024-02-12 10:00:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000001', 'completed', '2024-03-01', '2024-02-27 15:30:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000002', 'completed', '2024-09-13', '2024-09-10 11:00:00+08', 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000003', 'in_progress', '2026-10-31', null, 'a0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000004', 'assigned', '2026-10-24', null, 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000005', 'e2000000-0000-4000-8000-000000000005', 'completed', '2025-06-20', '2025-06-18 09:00:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000006', 'assigned', '2026-10-17', null, 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000006', 'assigned', '2026-10-24', null, 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000006', 'assigned', '2026-11-07', null, 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000007', 'in_progress', '2026-10-24', null, 'a0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000003', 'e2000000-0000-4000-8000-000000000007', 'assigned', '2026-11-14', null, 'a0000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000008', 'assigned', '2026-11-07', null, 'a0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000004', 'e2000000-0000-4000-8000-000000000008', 'assigned', '2026-11-21', null, 'a0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000009', 'completed', '2026-10-30', '2026-10-05 14:00:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000010', 'in_progress', '2026-10-15', null, 'a0000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000011', 'assigned', '2026-10-22', null, 'a0000000-0000-4000-8000-000000000004'),
  ('e1000000-0000-4000-8000-000000000006', 'e2000000-0000-4000-8000-000000000012', 'completed', '2026-10-09', '2026-10-04 16:45:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('e1000000-0000-4000-8000-000000000007', 'e2000000-0000-4000-8000-000000000013', 'completed', '2022-02-04', '2022-02-01 10:00:00+08', 'a0000000-0000-4000-8000-000000000002')
on conflict (course_id, employee_id) do update set
  status = excluded.status,
  due_date = excluded.due_date,
  completed_at = excluded.completed_at,
  assigned_by = excluded.assigned_by;
