-- deals.probability is a percentage, 0 to 100, and the database now says so.
--
-- The column was declared bare `numeric` in 20260711000006_crm.sql with no
-- precision, scale or check, so nothing distinguished 50 from 0.5. seed.sql
-- inserted 0.5 and 0.2, i.e. fractions, while both deal forms have always
-- labelled the field "Probability (%)" with min="0" max="100". The result was a
-- deal card reading "0.5%" for a deal at 50%, and a record page redisplaying
-- 0.5 into an input whose contract is percent. Finding B3 of the 2026-09-08
-- visual audit.
--
-- The backfill converts values strictly below 1 and above 0. A stored 1 is left
-- alone, because 1 is ambiguous between "1%" and "100%" and the conservative
-- reading of a percent column is 1%. Only the two seeded rows are affected in
-- this database; the bound is written this way so the migration is safe to run
-- against any other.

update deals
   set probability = probability * 100
 where probability is not null
   and probability > 0
   and probability < 1;

alter table deals
  add constraint deals_probability_pct
  check (probability is null or (probability >= 0 and probability <= 100));
