-- Add the seven subscribed tables to the supabase_realtime publication.
--
-- Nine components subscribe to postgres_changes: RequisitionListPage,
-- CandidateListPage, ApplicationPipeline, RequisitionRecordPage,
-- HiredPromotionListener, the intake badge hook, the dashboard hooks, and the
-- My Reminders and My Tasks panels.
-- Verified on a migration-built database on 2026-09-01: the
-- supabase_realtime publication contained zero tables, so not one of those
-- subscriptions could ever fire. Nothing in the repository added them, so a
-- database built from these migrations has never had working live updates.
--
-- This is what "unviewed badge decrements live, no reload" (criterion 2.2) and
-- "deal kanban drag persists stage, timeline updates live" (3.3) depend on. It
-- also gates the contact-promotion banner, which listens for
-- application.hired on events_outbox.
--
-- Replica identity is left at the default (primary key). Every subscriber
-- re-fetches on any event rather than reading the payload, so the old-row image
-- that REPLICA IDENTITY FULL would add is not needed, and full identity would
-- write the whole previous row to WAL on every update.
--
-- Tables are added individually and guarded, so this is safe to re-run and does
-- not disturb whatever the hosted project already publishes.

do $realtime$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is absent; skipping';
    return;
  end if;

  foreach t in array array[
    'applications',
    'application_views',
    'candidate_profiles',
    'intake_items',
    'events_outbox',
    'reminders',
    'tasks'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'added public.% to supabase_realtime', t;
    end if;
  end loop;
end $realtime$;
