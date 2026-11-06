-- Candidate statuses, agreed in the 2026-11-05 review.
--
-- The list people can choose from becomes: Talent Pool (the default), Sent
-- InMail I (Linkedin), In Pursuit, Flag, Resume Provided, Reference Provider,
-- Do Not Pursue, Rejected, in that workflow order. Candidate to Review Info,
-- Placed and Submitted are retired.
--
-- Retiring is is_active = false and nothing else. Every candidate who already
-- holds a retired status keeps it, and the record page still shows it, because
-- only new choices read the active flag. In Pursuit is new: a promising prospect
-- the team is still trying to reach on several channels, as opposed to Flag,
-- which is someone already in active communication.
--
-- Do Not Pursue keeps its label. The review called it "do not pursue now", but
-- the Zoho import maps by label and a rename would orphan that mapping.

update public.candidate_statuses
set is_active = false
where label in ('Candidate to Review Info', 'Placed', 'Submitted');

insert into public.candidate_statuses (label, sort_order, is_active)
select 'In Pursuit', 0, true
where not exists (select 1 from public.candidate_statuses where label = 'In Pursuit');

update public.candidate_statuses
set sort_order = case label
  when 'Talent Pool' then 1
  when 'Sent InMail I (Linkedin)' then 2
  when 'In Pursuit' then 3
  when 'Flag' then 4
  when 'Resume Provided' then 5
  when 'Reference Provider' then 6
  when 'Do Not Pursue' then 7
  when 'Rejected' then 8
  else 100 + sort_order
end
where sort_order < 100;
