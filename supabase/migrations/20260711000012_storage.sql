-- Storage bucket 'attachments'. Guarded: the storage schema only exists on
-- Supabase, so this is a no-op on plain Postgres (noted in README).
-- Download allowed only when the attachments row's parent record is readable;
-- uploads restricted to authenticated staff.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    raise notice 'storage schema absent (local run): skipping bucket + storage policies';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

  execute $pol$
    create policy attachments_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'attachments' and public.get_my_role() is not null)
  $pol$;

  execute $pol$
    create policy attachments_download on storage.objects for select to authenticated
      using (
        bucket_id = 'attachments'
        and exists (
          select 1 from public.attachments a
          where a.storage_path = storage.objects.name
            and (public.get_my_role() = 'admin'
                 or public.can_read_record(a.parent_type, a.parent_id))
        )
      )
  $pol$;

  execute $pol$
    create policy attachments_remove on storage.objects for delete to authenticated
      using (
        bucket_id = 'attachments'
        and exists (
          select 1 from public.attachments a
          where a.storage_path = storage.objects.name
            and (public.get_my_role() = 'admin'
                 or public.can_read_record(a.parent_type, a.parent_id))
        )
      )
  $pol$;
end $$;
