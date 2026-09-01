-- Display-code sequences: REQ-0001, APP-0001, DEAL-0001, TKT-0001.
-- Sequences never reset, so codes never repeat. Padding grows past 9999 without truncation.
create sequence req_display_seq;
create sequence app_display_seq;
create sequence deal_display_seq;
create sequence tkt_display_seq;

create or replace function public.next_display_code(prefix text)
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := case prefix
    when 'REQ'  then nextval('public.req_display_seq')
    when 'APP'  then nextval('public.app_display_seq')
    when 'DEAL' then nextval('public.deal_display_seq')
    when 'TKT'  then nextval('public.tkt_display_seq')
    else null
  end;
  if n is null then
    raise exception 'unknown display code prefix: %', prefix;
  end if;
  return prefix || '-' || lpad(n::text, greatest(4, length(n::text)), '0');
end $$;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;
