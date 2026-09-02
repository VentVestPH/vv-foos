import { execFileSync } from 'node:child_process';

const DB_URL = process.env.FOOS_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

function q(sql) {
  return execFileSync('psql', [DB_URL, '-At', '-c', sql], { encoding: 'utf8' }).trim();
}

let pending;
let orphans;
let errors;
try {
  pending = Number(
    q(`select count(*) from public.attachment_deletion_queue q
        where q.deleted_at is null
          and exists (select 1 from storage.objects o
                       where o.bucket_id = 'attachments' and o.name = q.storage_path)`),
  );
  orphans = Number(
    q(`select count(*) from storage.objects o
        where o.bucket_id = 'attachments'
          and not exists (select 1 from public.attachments a where a.storage_path = o.name)`),
  );
  errors = Number(q('select count(*) from public.client_errors'));
} catch {
  console.log('No reachable local database; skipping the attachment-queue check.');
  process.exit(0);
}

if (pending === 0 && orphans === 0 && errors === 0) {
  console.log('No attachment files awaiting deletion, no orphaned objects, no leaked error rows.');
  process.exit(0);
}

if (orphans > 0 || pending > 0) {
  console.error(
    `${orphans} orphaned storage object(s) and ${pending} queued file(s) still present.\n` +
      'An attachment row was deleted without removing its file first, so the file is now\n' +
      'unreachable through the Storage API (the DELETE policy matches on that row).\n' +
      'Drain it with: node scripts/purge-orphan-attachments.mjs --apply',
  );
}

if (errors > 0) {
  console.error(
    `${errors} client_errors row(s) left behind. A test that records a failure must delete it\n` +
      'again, and the delete needs an admin client: without the admin DELETE policy every\n' +
      'teardown is refused silently unless the caller checks the error.',
  );
}

process.exit(1);
