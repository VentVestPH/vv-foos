do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    raise notice 'storage schema absent (local run): skipping bucket limits';
    return;
  end if;

  update storage.buckets
  set file_size_limit = 26214400,
      allowed_mime_types = array[
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/rtf',
        'application/zip',
        'application/octet-stream',
        'text/plain',
        'text/csv',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/heic',
        'image/tiff'
      ]
  where id = 'attachments';
end $$;
