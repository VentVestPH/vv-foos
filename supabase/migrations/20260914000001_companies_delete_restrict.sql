-- QA-063: deleting a company cascaded into four tables.
--
-- requisitions, contact_profiles, deals and activities all referenced
-- companies with `on delete cascade`, and companies_write is a single
-- `for all` policy granting admin and bd every verb. One DELETE from either
-- role therefore removed that account's entire requisition and deal history
-- without a warning, which is why the product shipped with no delete control
-- anywhere. CompanyDeleteDialog now counts dependents before offering to
-- remove anything, but that guard lives in the browser and nothing enforced
-- it underneath: a direct PostgREST call, a script, or a future screen would
-- have had the old reach.
--
-- `restrict` makes the database refuse instead. The dialog still does the
-- counting, because a clear "3 requisitions, 1 deal" is a better answer than
-- a foreign key violation, but the constraint is now the thing that decides.
--
-- tickets.company_id stays `on delete set null`: a ticket outliving its
-- account is a closed ticket with no account, not a contradiction.
--
-- Reversible. Swap `restrict` back to `cascade` in a follow-up migration if
-- an account import ever needs the old behaviour, but read QA-063 first.

alter table public.requisitions
  drop constraint if exists requisitions_company_id_fkey;
alter table public.requisitions
  add constraint requisitions_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;

alter table public.contact_profiles
  drop constraint if exists contact_profiles_company_id_fkey;
alter table public.contact_profiles
  add constraint contact_profiles_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;

alter table public.deals
  drop constraint if exists deals_company_id_fkey;
alter table public.deals
  add constraint deals_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;

alter table public.activities
  drop constraint if exists activities_company_id_fkey;
alter table public.activities
  add constraint activities_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete restrict;
