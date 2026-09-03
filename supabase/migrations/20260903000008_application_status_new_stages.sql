-- Teach the applicant-facing projection about the three stages added in
-- 20260903000007, and stop it returning NULL for any stage it does not know.
--
-- fn_application_status translates an internal stage into language an applicant
-- can read, reached through a status token. Its two CASE expressions had no ELSE,
-- so adding talent_pool, outreach and associated made an applicant on one of
-- those rows see a null headline and a null detail. With 83,022 talent_pool rows
-- arriving from Zoho that is the common case, not the edge case.
--
-- The wording for the new stages is deliberately not "Application received".
-- A talent_pool row means we hold someone's details, not that they applied to
-- that opening, and telling them otherwise through a public status page would be
-- a misrepresentation. Same for outreach, which means we approached them.
--
-- The ELSE arms exist so that the next stage added here fails visibly as an
-- unhelpful-but-honest string rather than as a null the caller has to guess at.

create or replace function public.fn_application_status(p_token uuid)
returns table (
  reference text,
  role_title text,
  location text,
  applied_on date,
  headline text,
  detail text,
  closed boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.display_code,
    r.title,
    r.location,
    a.applied_at::date,
    case a.stage
      when 'talent_pool' then 'In our talent pool'
      when 'outreach' then 'We contacted you'
      when 'associated' then 'Being considered'
      when 'received' then 'Application received'
      when 'screening' then 'Under review'
      when 'phone_screen' then 'Phone screen'
      when 'submitted' then 'Submitted to the hiring company'
      when 'client_interview' then 'Interviewing'
      when 'offer' then 'At offer stage'
      when 'hired' then 'Offer accepted'
      when 'rejected' then 'Not moving forward'
      else 'Status unavailable'
    end,
    case a.stage
      when 'talent_pool' then 'We hold your details for future roles. You have not been put forward for this one.'
      when 'outreach' then 'A recruiter contacted you about this role and is waiting to hear back.'
      when 'associated' then 'A recruiter has attached your profile to this role and has not reviewed it yet.'
      when 'received' then 'We have your application and a recruiter will look at it.'
      when 'screening' then 'A recruiter is reading your application now.'
      when 'phone_screen' then 'You are at the phone screen stage.'
      when 'submitted' then 'Your application has been put forward to the hiring company.'
      when 'client_interview' then 'You are in the interview stage for this role.'
      when 'offer' then 'An offer is being prepared or discussed.'
      when 'hired' then 'You accepted an offer for this role.'
      when 'rejected' then 'We are not moving forward with this application. Thank you for applying.'
      else 'We cannot show a status for this application right now.'
    end,
    a.stage in ('hired', 'rejected')
  from applications a
  join requisitions r on r.id = a.requisition_id
  where a.status_token = p_token;
$$;

revoke all on function public.fn_application_status(uuid) from public, anon, authenticated;
grant execute on function public.fn_application_status(uuid) to service_role;
