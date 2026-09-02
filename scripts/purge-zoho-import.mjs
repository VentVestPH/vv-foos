#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

const target = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target) && !ALLOW_REMOTE) {
  console.error(
    `Refusing to delete from ${target}.\n` +
      'This removes every row the Zoho importer created. Local only unless --allow-remote is passed.',
  );
  process.exit(1);
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const env = execSync('supabase status -o env', { encoding: 'utf8' });
    return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
  } catch {
    return null;
  }
}

const key = serviceKey();
if (!key) {
  console.error('No service-role key. Set SUPABASE_SERVICE_ROLE_KEY or start the local stack.');
  process.exit(1);
}

const db = createClient(target, key, { auth: { persistSession: false } });

const { data: map, error: mapErr } = await db.from('zoho_id_map').select('zoho_id, entity_type, foos_id');
if (mapErr) {
  console.error(`Could not read zoho_id_map: ${mapErr.message}`);
  process.exit(1);
}

const byType = new Map();
for (const row of map ?? []) {
  if (!byType.has(row.entity_type)) byType.set(row.entity_type, []);
  byType.get(row.entity_type).push(row.foos_id);
}
const ids = (type) => byType.get(type) ?? [];

const plan = [
  ['storage objects for imported attachments', ids('attachment').length],
  ['attachments', ids('attachment').length],
  ['activities (imported notes)', ids('note').length],
  ['candidate_profiles and contact_profiles', ids('candidate').length + ids('contact').length],
  ['people', ids('candidate').length + ids('contact').length],
  ['companies', ids('company').length],
  ['zoho_id_map rows', (map ?? []).length],
];

console.log(`${APPLY ? 'Purging' : 'Purge dry run'} against ${target}`);
for (const [what, n] of plan) console.log(`  ${String(n).padStart(4)}  ${what}`);

if (!APPLY) {
  console.log('\nNothing deleted. Re-run with --apply.');
  process.exit(0);
}

async function removeStorage(attachmentIds) {
  if (!attachmentIds.length) return 0;
  const { data } = await db.from('attachments').select('storage_path').in('id', attachmentIds);
  const paths = (data ?? []).map((a) => a.storage_path).filter(Boolean);
  if (!paths.length) return 0;
  const { data: removed } = await db.storage.from('attachments').remove(paths);
  return (removed ?? []).length;
}

async function del(table, column, values) {
  if (!values.length) return 0;
  let removed = 0;
  for (let i = 0; i < values.length; i += 200) {
    const slice = values.slice(i, i + 200);
    const { data, error } = await db.from(table).delete().in(column, slice).select('*', { count: 'exact', head: false });
    if (error) throw new Error(`${table}: ${error.message}`);
    removed += (data ?? []).length;
  }
  return removed;
}

try {
  const objects = await removeStorage(ids('attachment'));
  const attachments = await del('attachments', 'id', ids('attachment'));
  const activities = await del('activities', 'id', ids('note'));
  const people = [...ids('candidate'), ...ids('contact')];
  const candidateProfiles = await del('candidate_profiles', 'person_id', people);
  const contactProfiles = await del('contact_profiles', 'person_id', people);
  const peopleRows = await del('people', 'id', people);
  const companies = await del('companies', 'id', ids('company'));
  const mapRows = await del('zoho_id_map', 'zoho_id', (map ?? []).map((m) => m.zoho_id));

  console.log('\nDeleted:');
  console.log(`  ${objects} storage object(s)`);
  console.log(`  ${attachments} attachment(s)`);
  console.log(`  ${activities} activity row(s)`);
  console.log(`  ${candidateProfiles} candidate_profile(s), ${contactProfiles} contact_profile(s)`);
  console.log(`  ${peopleRows} person row(s)`);
  console.log(`  ${companies} company row(s)`);
  console.log(`  ${mapRows} zoho_id_map row(s)`);
} catch (e) {
  console.error(`Purge failed part-way: ${e.message}`);
  process.exit(1);
}
