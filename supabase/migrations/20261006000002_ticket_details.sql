-- Ticket descriptions and labels for the internal support workflow.
-- The description is sanitised HTML written by the ticket editor. Inline images are stored
-- as attachment storage paths in img src and are signed by the client when rendered.
alter table public.tickets
  add column if not exists description text,
  add column if not exists tags text[] not null default '{}';

comment on column public.tickets.description is
  'Sanitised HTML ticket description. Inline images reference public.attachments storage paths.';
comment on column public.tickets.tags is
  'Short labels used to organize and filter support tickets.';
