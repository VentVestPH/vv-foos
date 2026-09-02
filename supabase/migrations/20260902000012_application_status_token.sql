-- Q7: a candidate-facing application status page.
--
-- An applicant submits through careers-apply and then hears nothing until a
-- human writes, so "did you get my CV" is the highest-volume inbound message
-- any ATS receives. This gives them a link they can check themselves.
--
-- The token is a random uuid on the application, unguessable and per
-- application, so a link reveals exactly one application and nothing else. It
-- is not derived from the application id, so possessing one link tells you
-- nothing about any other.
--
-- No new RLS grant: the status endpoint runs with the service role and selects
-- one row by token, returning a deliberately narrow projection. anon is given
-- nothing at all on applications, which is why this cannot be a direct
-- PostgREST read.
--
-- fn_application_status_view maps the internal stage onto applicant-facing
-- language. The internal names are for recruiters: an applicant should never be
-- shown "screening" or read a rejection as a stage label in a URL they can
-- share. The mapping lives in SQL so the endpoint cannot drift from it.

alter table applications
  add column if not exists status_token uuid not null default gen_random_uuid();

create unique index if not exists uq_applications_status_token
  on applications (status_token);

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
      when 'received' then 'Application received'
      when 'screening' then 'Under review'
      when 'phone_screen' then 'Phone screen'
      when 'submitted' then 'Submitted to the hiring company'
      when 'client_interview' then 'Interviewing'
      when 'offer' then 'At offer stage'
      when 'hired' then 'Offer accepted'
      when 'rejected' then 'Not moving forward'
    end,
    case a.stage
      when 'received' then 'We have your application and a recruiter will look at it.'
      when 'screening' then 'A recruiter is reading your application now.'
      when 'phone_screen' then 'You are at the phone screen stage.'
      when 'submitted' then 'Your application has been put forward to the hiring company.'
      when 'client_interview' then 'You are in the interview stage for this role.'
      when 'offer' then 'An offer is being prepared or discussed.'
      when 'hired' then 'You accepted an offer for this role.'
      when 'rejected' then 'We are not moving forward with this application. Thank you for applying.'
    end,
    a.stage in ('hired', 'rejected')
  from applications a
  join requisitions r on r.id = a.requisition_id
  where a.status_token = p_token;
$$;

revoke all on function public.fn_application_status(uuid) from public;
grant execute on function public.fn_application_status(uuid) to service_role;
