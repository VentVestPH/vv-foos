-- FOOS seed: lookups, admin staff, and a synthetic demo dataset (is_test = true).
-- No real candidate or customer PII in this file — every person and company is invented.

-- ------------------------------------------------------------------- sources

insert into sources (name) values
  ('LinkedIn'), ('Referral'), ('Agency'), ('Careers page'),
  ('Email'), ('Sheet import'), ('Other');

-- -------------------------------------------------------- candidate_statuses
-- Seeded verbatim from Taleo's Main Status dropdown (values confirmed in
-- screenshots). 'Sent InMail I (Linkedin)' implies a numbered InMail sequence:
-- the complete list exports from Taleo at Phase 4 migration and imports as-is;
-- nothing gets renamed. FOOS adds only 'Placed' as the end state.

insert into candidate_statuses (label, sort_order, is_active) values
  ('Resume Provided by Third Party', 1, true),
  ('Candidate to Review Info',       2, true),
  ('Sent InMail I (Linkedin)',       3, true),
  ('Placed',                         4, true);

-- --------------------------------------------------------------------- staff
-- John is the real admin seed. Rita/Sam/Ben are demo examples, one per role;
-- staff has no is_test flag, so delete these three before cutover. In
-- production every staff.id must equal an auth.users.id.

insert into staff (id, full_name, email, role, title, is_active) values
  ('a0000000-0000-4000-8000-000000000001', 'John Buena', 'john@ventvest.com', 'admin', 'Managing Director', true),
  ('a0000000-0000-4000-8000-000000000002', 'Rita Demo (recruiter)', 'rita.demo@ventvest.com', 'recruiter', 'Recruiter', true),
  ('a0000000-0000-4000-8000-000000000003', 'Sam Demo (sourcer)', 'sam.demo@ventvest.com', 'sourcer', 'Sourcer', true),
  ('a0000000-0000-4000-8000-000000000004', 'Ben Demo (bd)', 'ben.demo@ventvest.com', 'bd', 'BD Manager', true);

update staff set manager_id = 'a0000000-0000-4000-8000-000000000001'
 where id <> 'a0000000-0000-4000-8000-000000000001';

-- ----------------------------------------------------------------- companies

insert into companies (id, name, types, website, city, country, owner_id, is_test) values
  ('c0000000-0000-4000-8000-000000000001', 'Aster Analytics',  '{client}',            'https://aster.example', 'Melbourne', 'Australia',   'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000002', 'Birchwood Labs',   '{client,employer}',   'https://birch.example', 'Auckland',  'New Zealand', 'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000003', 'Corvid Systems',   '{client}',            'https://corvid.example', 'Sydney',   'Australia',   'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000004', 'Dune Retail Group','{prospect}',          'https://dune.example',  'Manila',    'Philippines', 'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000005', 'Ember Health',     '{prospect}',          'https://ember.example', 'Singapore', 'Singapore',   'a0000000-0000-4000-8000-000000000004', true);

-- -------------------------------------------------------------------- people
-- 10 demo people: 5 candidate-only (3 sourced by Sam), 3 contact-only, 2 both.

insert into people (id, first_name, last_name, headline, emails, linkedin_public_url, city, country, is_test, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'Priya',  'Nair',     'Data engineer',        '[{"type":"personal","address":"priya.nair@example.com"}]',  'https://linkedin.com/in/demo-priya',  'Melbourne', 'Australia',   true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'Marco',  'Silva',    'Frontend developer',   '[{"type":"personal","address":"marco.silva@example.com"}]', 'https://linkedin.com/in/demo-marco',  'Auckland',  'New Zealand', true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'Alena',  'Kovac',    'DevOps engineer',      '[{"type":"personal","address":"alena.kovac@example.com"}]', 'https://linkedin.com/in/demo-alena',  'Sydney',    'Australia',   true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000004', 'Tomas',  'Reyes',    'QA analyst',           '[{"type":"personal","address":"tomas.reyes@example.com"}]', 'https://linkedin.com/in/demo-tomas',  'Manila',    'Philippines', true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000005', 'Hana',   'Ito',      'Product designer',     '[{"type":"personal","address":"hana.ito@example.com"}]',    'https://linkedin.com/in/demo-hana',   'Singapore', 'Singapore',   true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000006', 'Greta',  'Larsen',   'Head of Engineering',  '[{"type":"work","address":"greta@aster.example"}]',         'https://linkedin.com/in/demo-greta',  'Melbourne', 'Australia',   true, 'a0000000-0000-4000-8000-000000000004'),
  ('b0000000-0000-4000-8000-000000000007', 'Oscar',  'Mendoza',  'Operations Director',  '[{"type":"work","address":"oscar@birch.example"}]',         'https://linkedin.com/in/demo-oscar',  'Auckland',  'New Zealand', true, 'a0000000-0000-4000-8000-000000000004'),
  ('b0000000-0000-4000-8000-000000000008', 'Lena',   'Fischer',  'Procurement Lead',     '[{"type":"work","address":"lena@corvid.example"}]',         'https://linkedin.com/in/demo-lena',   'Sydney',    'Australia',   true, 'a0000000-0000-4000-8000-000000000004'),
  ('b0000000-0000-4000-8000-000000000009', 'Ravi',   'Sharma',   'Placed engineer, now client contact', '[{"type":"personal","address":"ravi.sharma@example.com"}]', 'https://linkedin.com/in/demo-ravi', 'Melbourne', 'Australia', true, 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000010', 'Mia',    'Tan',      'Candidate and prospect contact',      '[{"type":"personal","address":"mia.tan@example.com"}]',     'https://linkedin.com/in/demo-mia',  'Singapore', 'Singapore', true, 'a0000000-0000-4000-8000-000000000002');

insert into candidate_profiles (person_id, status_id, star_grade, grade_comment, current_title, current_employer, source_id, sourcer_id) values
  ('b0000000-0000-4000-8000-000000000001', (select id from candidate_statuses where label = 'Sent InMail I (Linkedin)'), 3, 'Strong pipeline fit', 'Data engineer', 'Aster Analytics', (select id from sources where name = 'LinkedIn'), 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000002', (select id from candidate_statuses where label = 'Candidate to Review Info'), 2, 'Good, verify stack',  'Frontend developer', 'Freelance',   (select id from sources where name = 'LinkedIn'), 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000003', (select id from candidate_statuses where label = 'Resume Provided by Third Party'), 1, 'Weak tenure history', 'DevOps engineer', 'Corvid Systems', (select id from sources where name = 'Agency'), 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000004', (select id from candidate_statuses where label = 'Candidate to Review Info'), 2, null, 'QA analyst', 'Dune Retail Group', (select id from sources where name = 'Referral'), null),
  ('b0000000-0000-4000-8000-000000000005', (select id from candidate_statuses where label = 'Sent InMail I (Linkedin)'), 3, null, 'Product designer', 'Ember Health', (select id from sources where name = 'LinkedIn'), null),
  ('b0000000-0000-4000-8000-000000000009', (select id from candidate_statuses where label = 'Placed'), 3, 'Placed at Aster', 'Senior engineer', 'Aster Analytics', (select id from sources where name = 'Referral'), null),
  ('b0000000-0000-4000-8000-000000000010', (select id from candidate_statuses where label = 'Candidate to Review Info'), 2, null, 'Marketing manager', 'Ember Health', (select id from sources where name = 'Email'), null);

insert into contact_profiles (person_id, company_id, title, is_primary) values
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Head of Engineering', true),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'Operations Director', true),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000003', 'Procurement Lead', false),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000001', 'Senior engineer', false),
  ('b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000004', 'Marketing manager', false);

-- ---------------------------------------------------------------- requisitions

insert into requisitions (id, job_code, title, status, company_id, location, employment_type, num_openings, pay_min, pay_max, pay_currency, opened_date, is_published, is_test) values
  ('d0000000-0000-4000-8000-000000000001', 'ASTER-1',  'Senior Data Engineer', 'open',  'c0000000-0000-4000-8000-000000000001', 'Melbourne (hybrid)', 'full_time', 1, 140000, 165000, 'AUD', '2026-06-01', true,  true),
  ('d0000000-0000-4000-8000-000000000002', 'BIRCH-1',  'Frontend Developer',   'open',  'c0000000-0000-4000-8000-000000000002', 'Auckland (remote)',  'full_time', 2, 110000, 130000, 'NZD', '2026-06-15', true,  true),
  ('d0000000-0000-4000-8000-000000000003', 'CORVID-1', 'DevOps Engineer',      'draft', 'c0000000-0000-4000-8000-000000000003', 'Sydney',             'contract',  1, null,   null,   'AUD', null,        false, true);

insert into requisition_owners (requisition_id, staff_id) values
  ('d0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002');

insert into requisition_approvers (requisition_id, staff_id, approver_type) values
  ('d0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'requisition');

-- ---------------------------------------------------------------- applications
-- 8 applications across stages; the hired row carries hired_at explicitly
-- (the trigger sets it only on stage transitions).

insert into applications (requisition_id, person_id, stage, next_step, source_id, hired_at, applied_at) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'received',        'Screen resume',       (select id from sources where name = 'LinkedIn'), null, '2026-06-20'),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'screening',       'Book phone screen',   (select id from sources where name = 'LinkedIn'), null, '2026-06-21'),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003', 'phone_screen',    'Debrief with client', (select id from sources where name = 'Agency'),   null, '2026-06-22'),
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', 'submitted',       'Await client review', (select id from sources where name = 'Referral'), null, '2026-06-23'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'client_interview','Schedule round 2',    (select id from sources where name = 'LinkedIn'), null, '2026-06-24'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000005', 'offer',           'Send offer letter',   (select id from sources where name = 'LinkedIn'), null, '2026-06-25'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000009', 'hired',           null,                  (select id from sources where name = 'Referral'), '2026-07-01', '2026-06-10'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000010', 'rejected',        null,                  (select id from sources where name = 'Email'),    null, '2026-06-26');

update applications set rejection_reason = 'Withdrew for another role'
 where person_id = 'b0000000-0000-4000-8000-000000000010'
   and requisition_id = 'd0000000-0000-4000-8000-000000000002';

-- ---------------------------------------------------------------------- deals

insert into deals (id, name, company_id, primary_contact_id, owner_id, stage, value, currency, probability, expected_close, is_test) values
  ('e0000000-0000-4000-8000-000000000001', 'Dune Retail - staffing retainer',  'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000004', 'proposal', 60000, 'AUD', 0.5, '2026-08-15', true),
  ('e0000000-0000-4000-8000-000000000002', 'Ember Health - exec search pilot', 'c0000000-0000-4000-8000-000000000005', null,                                   'a0000000-0000-4000-8000-000000000004', 'lead',     25000, 'SGD', 0.2, '2026-09-30', true);

-- ------------------------------------------------- activities, tasks, reminders

insert into activities (kind, subject, body, person_id, requisition_id, created_by) values
  ('note', 'Initial screen notes', 'Solid Spark and dbt background.', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('call', 'Intro call', '15 min intro; open to Melbourne hybrid.', 'b0000000-0000-4000-8000-000000000002', null, 'a0000000-0000-4000-8000-000000000002');

insert into activities (kind, subject, body, person_id, company_id, deal_id, created_by) values
  ('meeting', 'Retainer scoping call', 'Walked through staffing volumes for H2.', 'b0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004');

insert into tasks (subject, due_date, priority, status, assignee_id, related_type, related_id) values
  ('Chase client feedback on Tomas Reyes', '2026-07-15', 'high', 'open', 'a0000000-0000-4000-8000-000000000002', 'requisition', 'd0000000-0000-4000-8000-000000000001'),
  ('Draft retainer proposal',              '2026-07-18', 'high', 'open', 'a0000000-0000-4000-8000-000000000004', 'deal',        'e0000000-0000-4000-8000-000000000001');

insert into reminders (staff_id, subject, remind_at, related_type, related_id, status) values
  ('a0000000-0000-4000-8000-000000000002', 'Follow up with Hana on offer', '2026-07-20 09:00+08', 'person', 'b0000000-0000-4000-8000-000000000005', 'pending'),
  ('a0000000-0000-4000-8000-000000000004', 'Nudge Dune Retail on proposal', '2026-07-22 09:00+08', 'deal', 'e0000000-0000-4000-8000-000000000001', 'pending');
