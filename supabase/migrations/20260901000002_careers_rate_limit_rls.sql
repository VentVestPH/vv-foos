-- QA-002: enable row-level security on public.careers_rate_limit.
--
-- The table was created in 20260725000001_careers.sql without RLS, so with the
-- anon key alone any visitor to the careers page could read every recorded IP
-- (personal data under GDPR Art. 4(1)), and could DELETE rows to reset their
-- own rate-limit bucket, defeating the 5-per-IP-per-hour throttle that is the
-- careers form's only abuse control.
--
-- No policies are added on purpose: nothing should reach this table through
-- PostgREST. Both legitimate callers bypass RLS already.
--   - public.careers_record_attempt is SECURITY DEFINER owned by postgres
--     (rolbypassrls), so the careers-apply Edge Function keeps working.
--   - service_role carries rolbypassrls for operational queries.
-- Verified on Postgres 17.6: anon and authenticated both carry
-- rolbypassrls = false, so RLS with zero policies denies them everything.
--
-- supabase/tests/validate.sql check 2 fails until this is applied, which is why
-- a fresh `supabase db reset` previously showed only 1 passing check.

alter table public.careers_rate_limit enable row level security;
