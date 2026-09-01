import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DB_URL = process.env.FOOS_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';
const API_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const BUCKET = 'attachments';
const DRY_RUN = !process.argv.includes('--apply');

function fromTestEnv(name) {
  if (process.env[name]) return process.env[name];
  if (!existsSync('tests/.env')) return null;
  const line = readFileSync('tests/.env', 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : null;
}

function orphanPaths() {
  const out = execFileSync(
    'psql',
    [
      DB_URL,
      '-At',
      '-c',
      `select o.name from storage.objects o
        where o.bucket_id = '${BUCKET}'
          and not exists (select 1 from public.attachments a where a.storage_path = o.name)
        order by o.created_at`,
    ],
    { encoding: 'utf8' },
  );
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

const paths = orphanPaths();
console.log(`${paths.length} orphaned object(s) in the ${BUCKET} bucket.`);
if (paths.length === 0) process.exit(0);

if (DRY_RUN) {
  for (const p of paths.slice(0, 20)) console.log(`  would delete  ${p}`);
  if (paths.length > 20) console.log(`  ... and ${paths.length - 20} more`);
  console.log('\nDry run. Re-run with --apply to delete.');
  process.exit(0);
}

const anonKey = fromTestEnv('FOOS_SUPABASE_ANON_KEY');
const email = process.env.FOOS_ADMIN_EMAIL ?? 'demo-admin@ventvest.test';
const password = fromTestEnv('FOOS_QA_TEST_PASSWORD');
if (!anonKey || !password) {
  console.error('Need FOOS_SUPABASE_ANON_KEY and FOOS_QA_TEST_PASSWORD (env or tests/.env).');
  process.exit(1);
}

const sb = createClient(API_URL, anonKey);
const { error: authErr } = await sb.auth.signInWithPassword({ email, password });
if (authErr) {
  console.error(`Could not sign in as ${email}: ${authErr.message}`);
  process.exit(1);
}

let deleted = 0;
let failed = 0;
for (const path of paths) {
  const { data: temp, error: insErr } = await sb
    .from('attachments')
    .insert({
      storage_path: path,
      parent_type: 'orphan_purge',
      parent_id: '00000000-0000-4000-8000-000000000000',
      kind: 'other',
    })
    .select('id')
    .single();
  if (insErr || !temp) {
    console.error(`  skip ${path}: ${insErr?.message ?? 'no row returned'}`);
    failed += 1;
    continue;
  }
  const { data, error } = await sb.storage.from(BUCKET).remove([path]);
  await sb.from('attachments').delete().eq('id', temp.id);
  if (error || !data || data.length === 0) {
    console.error(`  failed ${path}: ${error?.message ?? 'remove was a no-op'}`);
    failed += 1;
  } else {
    deleted += 1;
  }
}
console.log(`Deleted ${deleted}, failed ${failed}.`);
process.exit(failed > 0 ? 1 : 0);
