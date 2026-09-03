-- Server-side paging for the contact list.
--
-- Fourth in the series. The old screen paged every contact_profiles row and then
-- asked for the matching people in a single .in() carrying every id it had just
-- collected. That second call is the more interesting failure: PostgREST puts the
-- id list in the query string, and roughly a thousand uuids is already a 37 KB
-- URI the server rejects with "URI too long". So at scale the screen does not
-- merely slow down, it fails outright, and check-unbounded-queries.mjs does not
-- catch it because a .in() looks like a narrowing filter.
--
-- security_invoker = on, an inner join to people because a contact profile
-- without a person is not a contact, and a LEFT join to companies so that a
-- contact whose company the caller cannot read keeps its row and loses only the
-- company name.

drop view if exists public.contact_list;

create view public.contact_list
with (security_invoker = on) as
select
  cp.person_id,
  p.first_name,
  p.middle_name,
  p.last_name,
  nullif(trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name)), '') as full_name,
  p.emails,
  p.phones,
  p.city,
  p.state,
  p.country,
  p.is_test,
  p.updated_at as person_updated_at,
  cp.company_id,
  c.name as company_name,
  cp.title,
  cp.is_primary,
  cp.since_date,
  lower(
    concat_ws(
      ' ',
      p.first_name,
      p.middle_name,
      p.last_name,
      cp.title,
      c.name,
      (
        select string_agg(entry ->> 'address', ' ')
        from jsonb_array_elements(
               case when jsonb_typeof(p.emails) = 'array' then p.emails else '[]'::jsonb end
             ) as entry
      )
    )
  ) as search_text
from public.contact_profiles cp
join public.people p on p.id = cp.person_id
left join public.companies c on c.id = cp.company_id;

comment on view public.contact_list is
  'Contact rows joined to people, with the company name, for server-side paging. security_invoker = on, so RLS on contact_profiles, people and companies still decides visibility.';

grant select on public.contact_list to authenticated;

create index if not exists idx_contact_profiles_company on public.contact_profiles (company_id);
