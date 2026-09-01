-- Agent 4 — Careers page support. Adds only what the public apply endpoint
-- needs beyond the Gate 1 schema: per-IP rate limiting for the unauthenticated
-- apply Edge Function. No RLS grants for anon here — the careers Edge
-- Functions read/write with the service role server-side, per the
-- architecture doc's "anon client never touches tables directly" rule; the
-- anon/public key is never used by the careers surface.

create table careers_rate_limit (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  created_at timestamptz not null default now()
);

create index idx_careers_rate_limit_ip_created on careers_rate_limit (ip, created_at desc);

-- Housekeeping: rows older than a day are noise once the rate-limit window
-- (1 hour) has passed. Not wired to pg_cron here to avoid a second cron
-- dependency; the Edge Function opportunistically prunes rows older than a
-- day on each request (see careers-apply/index.ts).

comment on table careers_rate_limit is
  'Per-IP submission timestamps for the careers apply Edge Function rate limiter (5/hour/IP default). Infrastructure table: no audit_log trigger, no RLS grants — service role only.';

-- ------------------------------------------------------------- dedup helpers
-- Callable via supabase-js .rpc() from the careers-apply Edge Function
-- (service role). Normalized primary email first, linkedin_public_url
-- second, per architecture section 3 ("Dedup key on people: normalized
-- primary email; secondary heuristic linkedin_public_url").

create or replace function public.find_person_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select p.id
    from people p, jsonb_array_elements(p.emails) e
   where lower(trim(e ->> 'address')) = lower(trim(p_email))
   order by p.created_at asc
   limit 1;
$$;

create or replace function public.find_person_by_linkedin(p_url text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id
    from people
   where linkedin_public_url is not null
     and lower(trim(linkedin_public_url)) = lower(trim(p_url))
   order by created_at asc
   limit 1;
$$;

-- Rate-limit check + record in one round trip: inserts the attempt, then
-- returns how many attempts this IP has made in the trailing hour (including
-- this one). The Edge Function rejects when the count exceeds the configured
-- ceiling (default 5/hour). Also opportunistically prunes rows older than a
-- day so the table doesn't grow unbounded.
create or replace function public.careers_record_attempt(p_ip text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  delete from careers_rate_limit where created_at < now() - interval '1 day';
  insert into careers_rate_limit (ip) values (p_ip);
  select count(*) into n from careers_rate_limit
   where ip = p_ip and created_at > now() - interval '1 hour';
  return n;
end $$;
