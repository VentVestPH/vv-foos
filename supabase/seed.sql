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
  ('Resume Provided by Third Party', 1, false),
  ('Candidate to Review Info',       2, true),
  ('Sent InMail I (Linkedin)',       3, true),
  ('Placed',                         4, true);

-- --------------------------------------------------------------------- staff
-- John is the real admin seed. The four foos.* rows are the test accounts, one
-- per role, and they are the only accounts the suites sign in as. staff has no
-- is_test flag, so delete those four by hand before cutover. In production
-- every staff.id must equal an auth.users.id.
--
-- Rewritten 2026-09-14. There were two overlapping sets: Rita/Sam/Ben here plus
-- a separate foos.* set added by hand through scripts/add-local-staff.sql, and
-- no admin row at all other than John, which is why personas.sql hung the
-- demo-admin login on John's id. That made an admin test session write as John
-- Buena, left john@ventvest.com unable to sign in, and would have overwritten
-- his real Google identity had personas.sql ever run against the live project.
-- One set now, one account per role. The ids stay on the a0000000 series so the
-- 33 owner references further down this file keep resolving.

insert into staff (id, full_name, email, role, title, is_active) values
  ('a0000000-0000-4000-8000-000000000001', 'John Buena', 'john@ventvest.com', 'admin', 'Managing Director', true),
  ('a0000000-0000-4000-8000-000000000002', 'FOOS Recruiter', 'foos.recruiter@ventvest.com', 'recruiter', 'Recruiter', true),
  ('a0000000-0000-4000-8000-000000000003', 'FOOS Sourcer', 'foos.sourcer@ventvest.com', 'sourcer', 'Sourcer', true),
  ('a0000000-0000-4000-8000-000000000004', 'FOOS BD', 'foos.bd@ventvest.com', 'bd', 'BD Manager', true),
  ('a0000000-0000-4000-8000-000000000005', 'FOOS Admin', 'foos.admin@ventvest.com', 'admin', 'Administrator', true);

update staff set manager_id = 'a0000000-0000-4000-8000-000000000001'
 where id <> 'a0000000-0000-4000-8000-000000000001';

-- ----------------------------------------------------------------- companies

insert into companies (id, name, types, website, city, country, owner_id, is_test) values
  ('c0000000-0000-4000-8000-000000000001', 'Aster Analytics',  '{client}',            'https://aster.example', 'Melbourne', 'Australia',   'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000002', 'Birchwood Labs',   '{client,employer}',   'https://birch.example', 'Auckland',  'New Zealand', 'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000003', 'Corvid Systems',   '{client}',            'https://corvid.example', 'Sydney',   'Australia',   'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000004', 'Dune Retail Group','{prospect}',          'https://dune.example',  'Manila',    'Philippines', 'a0000000-0000-4000-8000-000000000004', true),
  ('c0000000-0000-4000-8000-000000000005', 'Ember Health',     '{prospect}',          'https://ember.example', 'Singapore', 'Singapore',   'a0000000-0000-4000-8000-000000000004', true);

-- One account with every accordion and every Activity tab populated, so the
-- record page can be looked at full rather than empty. Nothing else in the seed
-- filled all five sections at once: Dune Retail had contacts, deals and 595
-- activities but no requisition, and the Zoho accounts have requisitions and
-- nothing else. Meridian carries a contact, an open deal, a requisition, and one
-- of each activity kind plus a task, a reminder and a file, which is what the
-- eight-tab strip needs to render with content in every tab.

insert into companies (id, name, types, website, phone, city, state, country, owner_id, is_test) values
  ('c0000000-0000-4000-8000-000000000009', 'Meridian Talent Partners', '{client,employer}', 'https://meridian.example', '+61 2 8000 4100', 'Sydney', 'NSW', 'Australia', 'a0000000-0000-4000-8000-000000000004', true);

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
  ('b0000000-0000-4000-8000-000000000003', (select id from candidate_statuses where label = 'Resume Provided'), 1, 'Weak tenure history', 'DevOps engineer', 'Corvid Systems', (select id from sources where name = 'Agency'), 'a0000000-0000-4000-8000-000000000003'),
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
  ('e0000000-0000-4000-8000-000000000001', 'Dune Retail - staffing retainer',  'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000004', 'proposal', 60000, 'AUD', 50, '2026-08-15', true),
  ('e0000000-0000-4000-8000-000000000002', 'Ember Health - exec search pilot', 'c0000000-0000-4000-8000-000000000005', null,                                   'a0000000-0000-4000-8000-000000000004', 'lead',     25000, 'SGD', 20, '2026-09-30', true);

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

-- ------------------------------------------------ Meridian, the full-record demo
-- Everything the account record page can show, on one account, so the layout can
-- be reviewed populated rather than empty. The Activity section's tab strip has
-- eight tabs and each needs its own row: a note, a call, a meeting, a meeting
-- carrying attendees (which is what the Events tab filters on), an email, a task,
-- a reminder and a file.

insert into people (id, first_name, last_name, headline, emails, phones, city, country, is_test, created_by) values
  ('b0000000-0000-4000-8000-000000000021', 'Priya', 'Raman', 'Head of Talent', '[{"type":"work","address":"priya.raman@meridian.example"}]', '[{"type":"work","number":"+61 2 8000 4111"}]', 'Sydney', 'Australia', true, 'a0000000-0000-4000-8000-000000000004');

insert into contact_profiles (person_id, company_id, title, is_primary) values
  ('b0000000-0000-4000-8000-000000000021', 'c0000000-0000-4000-8000-000000000009', 'Head of Talent', true);

insert into deals (id, name, company_id, primary_contact_id, owner_id, stage, value, currency, probability, expected_close, is_test) values
  ('e0000000-0000-4000-8000-000000000009', 'Meridian - annual RPO retainer', 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000004', 'proposal', 240000, 'AUD', 60, '2026-10-14', true);

insert into requisitions (id, job_code, title, status, company_id, location, employment_type, num_openings, pay_min, pay_max, pay_currency, opened_date, is_published, is_test) values
  ('d0000000-0000-4000-8000-000000000009', 'MER-1', 'Engineering Manager', 'open', 'c0000000-0000-4000-8000-000000000009', 'Sydney (hybrid)', 'full_time', 2, 180000, 210000, 'AUD', '2026-08-15', false, true);

insert into requisition_owners (requisition_id, staff_id) values
  ('d0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005');

insert into activities (kind, subject, body, company_id, created_by) values
  ('note',  'Kickoff notes',          'Meridian want two EM hires before end of quarter.', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005'),
  ('call',  'Intro call with Priya',  'Walked through the retainer and the EM brief.',     'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005'),
  ('email', 'Retainer proposal sent', 'Sent the proposal for countersignature.',           'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005');

insert into activities (kind, subject, body, company_id, created_by, attendees) values
  ('meeting', 'Hiring manager briefing', 'Scoped the EM role with the two hiring managers.', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000005', '[{"email":"priya.raman@meridian.example","name":"Priya Raman"}]');

insert into tasks (subject, due_date, priority, status, assignee_id, related_type, related_id) values
  ('Send shortlist of 5 EM candidates', '2026-09-18', 'high', 'open', 'a0000000-0000-4000-8000-000000000005', 'company', 'c0000000-0000-4000-8000-000000000009');

insert into reminders (staff_id, subject, remind_at, related_type, related_id, status) values
  ('a0000000-0000-4000-8000-000000000005', 'Chase the countersigned retainer', '2026-09-17 09:00+08', 'company', 'c0000000-0000-4000-8000-000000000009', 'pending');

insert into attachments (storage_path, parent_type, parent_id, kind, description, file_size_bytes, uploaded_by) values
  ('company/c0000000-0000-4000-8000-000000000009/meridian-retainer.pdf', 'company', 'c0000000-0000-4000-8000-000000000009', 'other', 'meridian-retainer.pdf', 184320, 'a0000000-0000-4000-8000-000000000005');

-- Two deals against the Meridian account so the deal record page can be looked
-- at full rather than empty. DEMO-1 fills every editable column except
-- lost_reason, which the page only shows on a lost deal, and populates all
-- eight Activity tabs: Notes, Calls, Meetings, Events, Emails, Tasks,
-- Reminders and Files. DEMO-2 is the lost counterpart, so the Lost reason
-- block and a zero probability are visible somewhere too.
--
-- Events are meetings that carry attendees, so the Meetings tab needs one
-- meeting without attendees and one with, or the two tabs show the same rows.

insert into deals (id, name, company_id, primary_contact_id, owner_id, stage, value, currency, probability, expected_close, lost_reason, is_test) values
  ('e0000000-0000-4000-8000-000000000010', 'Meridian - executive search programme', 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000004', 'negotiation', 480000, 'AUD', 75, '2026-11-28', null, true),
  ('e0000000-0000-4000-8000-000000000011', 'Meridian - contract-to-hire pilot',     'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000021', 'a0000000-0000-4000-8000-000000000004', 'lost',        96000,  'AUD', 0,  '2026-09-05', 'Budget moved to an internal referral scheme for the pilot cohort. Revisit at the next planning round.', true);

insert into activities (kind, subject, body, occurred_at, deal_id, company_id, created_by) values
  ('note',  'Programme scope agreed',   'Four executive searches across engineering and operations, run as one programme rather than four separate briefs.', '2026-09-02 09:15+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('note',  'Rate card feedback',       'They want the retained fee staged across three milestones instead of two. Finance are fine with it.',              '2026-09-08 16:40+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('call',  'Commercial terms call',    'Walked the staged fee structure and the replacement guarantee. No objections raised.',                            '2026-09-04 11:00+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('call',  'Follow-up on timelines',   'Confirmed the first two searches start in October, the other two in January.',                                    '2026-09-09 10:20+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('email', 'Programme proposal sent',  'Sent the four-search programme proposal with the staged fee schedule attached.',                                   '2026-09-05 08:05+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('email', 'Redlines returned',        'Legal returned the agreement with two redlines, both on the notice period.',                                       '2026-09-11 14:30+08', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('note',  'Why this one closed lost', 'Held the pricing but lost on timing. Worth reopening when the referral scheme is reviewed.',                       '2026-09-05 17:00+08', 'e0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004');

insert into activities (kind, subject, body, occurred_at, ends_at, location, all_day, deal_id, company_id, created_by) values
  ('meeting', 'Internal deal review', 'Pipeline review of the programme before sending terms. No client attendees.', '2026-09-03 15:00+08', '2026-09-03 15:45+08', 'VentVest Manila, Room 2', false, 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004');

insert into activities (kind, subject, body, occurred_at, ends_at, location, all_day, attendees, deal_id, company_id, created_by) values
  ('meeting', 'Terms walkthrough with Meridian', 'Walked the staged fee schedule and the replacement guarantee with the client.', '2026-09-10 13:00+08', '2026-09-10 14:00+08', 'Google Meet', false, '[{"email":"priya.raman@meridian.example","name":"Priya Raman"}]', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004'),
  ('meeting', 'Signature session',               'Final read-through before countersignature.',                                   '2026-09-19 09:30+08', '2026-09-19 10:15+08', 'Meridian Sydney office', false, '[{"email":"priya.raman@meridian.example","name":"Priya Raman"},{"email":"ben.demo@ventvest.com","name":"Ben Aquino"}]', 'e0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000004');

insert into tasks (subject, due_date, priority, status, assignee_id, related_type, related_id, completed_at) values
  ('Return the redlined agreement to Meridian legal', '2026-09-16', 'high',   'open', 'a0000000-0000-4000-8000-000000000004', 'deal', 'e0000000-0000-4000-8000-000000000010', null),
  ('Confirm the October start dates with delivery',   '2026-09-22', 'normal', 'open', 'a0000000-0000-4000-8000-000000000004', 'deal', 'e0000000-0000-4000-8000-000000000010', null),
  ('Build the staged fee schedule',                   '2026-09-04', 'normal', 'done', 'a0000000-0000-4000-8000-000000000004', 'deal', 'e0000000-0000-4000-8000-000000000010', '2026-09-04 18:00+08');

insert into reminders (staff_id, subject, remind_at, related_type, related_id, status) values
  ('a0000000-0000-4000-8000-000000000004', 'Chase the countersigned programme agreement', '2026-09-17 09:00+08', 'deal', 'e0000000-0000-4000-8000-000000000010', 'pending'),
  ('a0000000-0000-4000-8000-000000000004', 'Diarise the January search kickoff',          '2026-12-08 09:00+08', 'deal', 'e0000000-0000-4000-8000-000000000010', 'pending'),
  ('a0000000-0000-4000-8000-000000000004', 'Reopen the pilot when budgets reset',         '2026-09-05 09:00+08', 'deal', 'e0000000-0000-4000-8000-000000000011', 'dismissed');

insert into attachments (storage_path, parent_type, parent_id, kind, description, file_size_bytes, uploaded_by) values
  ('deal/e0000000-0000-4000-8000-000000000010/programme-proposal.pdf',  'deal', 'e0000000-0000-4000-8000-000000000010', 'other',    'programme-proposal.pdf',  246784, 'a0000000-0000-4000-8000-000000000004'),
  ('deal/e0000000-0000-4000-8000-000000000010/programme-agreement.pdf', 'deal', 'e0000000-0000-4000-8000-000000000010', 'contract', 'programme-agreement.pdf', 318464, 'a0000000-0000-4000-8000-000000000004'),
  ('deal/e0000000-0000-4000-8000-000000000010/fee-schedule.xlsx',       'deal', 'e0000000-0000-4000-8000-000000000010', 'other',    'fee-schedule.xlsx',        42496, 'a0000000-0000-4000-8000-000000000004');
