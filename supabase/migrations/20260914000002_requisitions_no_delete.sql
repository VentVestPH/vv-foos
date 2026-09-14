-- QA-067: requisitions_write was `for all`, which includes DELETE.
--
-- Carried finding S8 and several session notes recorded "no DELETE policy on
-- requisitions". That was wrong. `for all` grants every verb, so any admin or
-- recruiter could delete a requisition through PostgREST today; the only thing
-- stopping them was the absence of a control in the UI.
--
-- That matters more here than on most tables. Four constraints reference
-- requisitions and applications is one of them, so a single delete removes
-- every candidate submission against that role, plus its owners, approvers and
-- activity. The hiring history is the product.
--
-- RLS in this schema is deny-by-default, so splitting the policy into explicit
-- INSERT and UPDATE halves leaves DELETE with no policy at all, which denies
-- it. SELECT is untouched and still comes from requisitions_select.
--
-- The forward verb stays `status` -> closed / filled. If a requisition ever
-- genuinely needs removing, that is a deliberate server-side job, not a button.

drop policy if exists requisitions_write on public.requisitions;

create policy requisitions_insert on public.requisitions
  for insert to public
  with check ((select get_my_role()) = any (array['admin'::text, 'recruiter'::text]));

create policy requisitions_update on public.requisitions
  for update to public
  using ((select get_my_role()) = any (array['admin'::text, 'recruiter'::text]))
  with check ((select get_my_role()) = any (array['admin'::text, 'recruiter'::text]));
