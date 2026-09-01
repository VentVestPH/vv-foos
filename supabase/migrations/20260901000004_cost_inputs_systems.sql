-- QA-008 support: register the systems whose cost the Phase 6 gate compares.
--
-- dash.cost_inputs existed with correct schema and RLS but zero rows, so
-- cost_monthly_total had nothing to sum and no UI could show what was missing.
-- These rows name the inputs the gate needs. monthly_cost is left NULL on
-- purpose: the actual contract figures are not recorded anywhere in this
-- repository, and a placeholder number would be indistinguishable from a real
-- one in the metric. Until an admin enters them, cost_monthly_total is NULL and
-- the dashboard reads "Not measured", which is accurate.
--
-- 'VentVest FOOS' is the replacement side of the comparison: the gate is
-- whether replacing the three subscriptions costs less to run.

insert into dash.cost_inputs (system, monthly_cost, currency) values
  ('Oracle Taleo', null, 'USD'),
  ('Zoho Recruit', null, 'USD'),
  ('Zoho CRM', null, 'USD'),
  ('VentVest FOOS', null, 'USD')
on conflict (system) do nothing;
