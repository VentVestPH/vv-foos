import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const DERIVED_WRITE_TRIGGERS = [
  ['people', 'trg_people_audit'],
  ['people', 'trg_people_updated_at'],
  ['companies', 'trg_companies_audit'],
  ['companies', 'trg_companies_updated_at'],
  ['requisitions', 'trg_requisitions_audit'],
  ['requisitions', 'trg_requisitions_updated_at'],
  ['requisitions', 'trg_requisitions_status'],
  ['applications', 'trg_applications_audit'],
  ['applications', 'trg_applications_created'],
  ['applications', 'trg_applications_stage_before'],
  ['applications', 'trg_applications_stage_after'],
  ['candidate_profiles', 'trg_candidate_profiles_audit'],
  ['candidate_profiles', 'trg_candidate_profiles_status'],
  ['contact_profiles', 'trg_contact_profiles_audit'],
  ['activities', 'trg_activities_audit'],
  ['activities', 'trg_activities_logged'],
  ['attachments', 'trg_attachments_audit'],
];

const KEPT = [
  ['applications', 'trg_applications_require_reason', 'validates an outcome reason'],
  ['candidate_profiles', 'trg_candidate_profiles_grade_guard', 'validates star_grade'],
  ['attachments', 'trg_attachments_queue_deletion', 'queues storage deletion'],
];

function isLocal(url) {
  return /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url);
}

function psql(sql) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' },
  });
}

if (!isLocal(DB_URL) && !has('--allow-remote')) {
  console.error(
    `Refusing to alter triggers on ${DB_URL.replace(/:[^:@]*@/, ':***@')}.\n` +
      'This disables audit and derived-write triggers. Point DATABASE_URL at the local\n' +
      'stack, or pass --allow-remote deliberately.',
  );
  process.exit(1);
}

const mode = has('--enable') ? 'ENABLE' : has('--disable') ? 'DISABLE' : has('--status') ? 'STATUS' : null;
if (!mode) {
  console.error(
    'Disable the audit and derived-write triggers for a bulk import, then put them back.\n\n' +
      '  node scripts/bulk-load-triggers.mjs --disable\n' +
      '  node migration/import.mjs --apply\n' +
      '  node scripts/bulk-load-triggers.mjs --enable\n' +
      '  node scripts/bulk-load-triggers.mjs --status\n\n' +
      'Why: fn_set_updated_at fires BEFORE UPDATE and overwrites the Zoho Modified_Time the\n' +
      'importer just supplied; fn_audit writes one audit_log row per insert and per update,\n' +
      'which is hundreds of thousands of rows describing the migration rather than the\n' +
      'business; and the application and status triggers write events_outbox rows that the\n' +
      'frontend consumes over Realtime, so an import would replay as tens of thousands of\n' +
      'fake live events.\n\n' +
      'Validation triggers are deliberately left enabled, so a bad row still fails.',
  );
  process.exit(1);
}

if (mode === 'STATUS') {
  const out = psql(`
    select c.relname || ' | ' || t.tgname || ' | ' ||
           case t.tgenabled when 'O' then 'enabled' when 'D' then 'DISABLED' else t.tgenabled::text end
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal
      and c.relname in ('people','companies','requisitions','applications',
                        'candidate_profiles','contact_profiles','activities','attachments')
    order by c.relname, t.tgname;
  `);
  const lines = out.trim().split('\n').filter(Boolean);
  const disabled = lines.filter((l) => l.endsWith('DISABLED'));
  for (const l of lines) console.log(`  ${l}`);
  console.log(`\n  ${disabled.length} of ${lines.length} trigger(s) disabled.`);
  if (disabled.length > 0) {
    console.log('  Run --enable before treating this database as live.');
  }
  process.exit(0);
}

const verb = mode === 'DISABLE' ? 'DISABLE' : 'ENABLE';
let changed = 0;
for (const [table, trigger] of DERIVED_WRITE_TRIGGERS) {
  try {
    psql(`alter table public.${table} ${verb} trigger ${trigger};`);
    changed += 1;
  } catch (e) {
    console.error(`  could not ${verb.toLowerCase()} ${table}.${trigger}: ${String(e.message).split('\n')[0]}`);
  }
}

console.log(`  ${verb.toLowerCase()}d ${changed} of ${DERIVED_WRITE_TRIGGERS.length} derived-write trigger(s)`);
console.log('  left enabled, because they validate rather than derive:');
for (const [table, trigger, why] of KEPT) console.log(`    ${table}.${trigger}  (${why})`);
if (mode === 'DISABLE') {
  console.log('\n  Remember: node scripts/bulk-load-triggers.mjs --enable');
}
