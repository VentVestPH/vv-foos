-- Synthetic tickets for the isolated FOOS local stack and local UI tests.
-- Seeded records use only the already synthetic companies, people and staff.
insert into public.tickets (
  id, subject, description, tags, company_id, person_id, status, priority, sla_due_at, resolved_at, assignee_id
) values
  ('f0000000-0000-4000-8000-000000000001', 'Confirm interview panel availability', 'The hiring team asked us to confirm a time that works for the full interview panel.', array['scheduling','interview'], 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'new', 'high', '2026-10-07 17:00:00+08', null, 'a0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000002', 'Update hiring manager contact details', 'Update the account contact information after the hiring manager moved teams.', array['account','contact'], 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007', 'new', 'normal', '2026-10-09 17:00:00+08', null, 'a0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000003', 'Candidate submission portal access', 'The client cannot open the latest candidate submissions in the shared portal.', array['access','portal'], 'c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000008', 'open', 'urgent', '2026-10-06 16:00:00+08', null, 'a0000000-0000-4000-8000-000000000004'),
  ('f0000000-0000-4000-8000-000000000004', 'Clarify shortlist feedback timeline', 'Follow up with the account team for feedback timing and communicate the next update.', array['follow-up','shortlist'], 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000010', 'open', 'high', '2026-10-08 12:00:00+08', null, 'a0000000-0000-4000-8000-000000000004'),
  ('f0000000-0000-4000-8000-000000000005', 'Reschedule weekly account review', 'The account review conflicts with a client meeting. Please find a new time.', array['scheduling','account'], 'c0000000-0000-4000-8000-000000000005', null, 'pending', 'normal', '2026-10-12 17:00:00+08', null, 'a0000000-0000-4000-8000-000000000004'),
  ('f0000000-0000-4000-8000-000000000006', 'Send revised role requirements', 'Send the updated position requirements document to the account contact for approval.', array['requirements','approval'], 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000021', 'pending', 'low', '2026-10-15 17:00:00+08', null, 'a0000000-0000-4000-8000-000000000005'),
  ('f0000000-0000-4000-8000-000000000007', 'Restore access to shared candidate notes', 'The account team confirmed that access was restored and candidate notes are visible again.', array['resolved','access'], 'c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006', 'resolved', 'normal', '2026-10-05 17:00:00+08', '2026-10-05 14:20:00+08', 'a0000000-0000-4000-8000-000000000002'),
  ('f0000000-0000-4000-8000-000000000008', 'Correct duplicate invoice contact', 'The billing contact entry was corrected and the duplicate record was removed.', array['billing','data-quality'], 'c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000010', 'resolved', 'low', '2026-10-02 17:00:00+08', '2026-10-02 10:15:00+08', 'a0000000-0000-4000-8000-000000000004'),
  ('f0000000-0000-4000-8000-000000000009', 'Confirm kickoff meeting notes', 'Kickoff notes were shared with the project team and the account record is up to date.', array['meeting','closed'], 'c0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000021', 'closed', 'normal', '2026-09-28 17:00:00+08', '2026-09-27 15:00:00+08', 'a0000000-0000-4000-8000-000000000005'),
  ('f0000000-0000-4000-8000-000000000010', 'Archive completed onboarding request', 'The completed onboarding request has been checked and archived.', array['onboarding','closed'], 'c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007', 'closed', 'low', '2026-09-25 17:00:00+08', '2026-09-24 11:45:00+08', 'a0000000-0000-4000-8000-000000000002')
on conflict (id) do update set
  subject = excluded.subject,
  description = excluded.description,
  tags = excluded.tags,
  company_id = excluded.company_id,
  person_id = excluded.person_id,
  status = excluded.status,
  priority = excluded.priority,
  sla_due_at = excluded.sla_due_at,
  resolved_at = excluded.resolved_at,
  assignee_id = excluded.assignee_id;
