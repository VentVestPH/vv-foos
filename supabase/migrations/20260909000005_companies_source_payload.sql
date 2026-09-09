-- companies keeps what Zoho sends that it has no column for.
--
-- 20260909000004 added the seven fields the 86 imported Zoho accounts actually
-- populated. mapCompany carries fifteen: PROFILE_COLUMNS lists eleven
-- (account_number, site, ticker, ownership, industry, employees,
-- annual_revenue, sic_code, rating, fax, description) and the mapper adds
-- street, postal_code, email and parent_account. Adding a column each would put
-- eight more on companies to hold fields no row currently fills, and would
-- still drop the next one Zoho adds.
--
-- source_payload takes whatever has no column, the same shape activities and
-- tasks use, so a field can be promoted later without re-reading Zoho.

alter table public.companies
  add column if not exists source_payload jsonb;
