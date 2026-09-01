#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MIGRATIONS_DIR = 'supabase/migrations';
const DEFAULT_DB = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const dbUrl = process.env.SUPABASE_DB_URL || DEFAULT_DB;

const repoVersions = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .map((f) => f.split('_')[0])
  .sort();

let appliedVersions;
try {
  const out = execFileSync(
    'psql',
    [dbUrl, '-tAc', 'select version from supabase_migrations.schema_migrations order by version'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  appliedVersions = out.split('\n').map((s) => s.trim()).filter(Boolean);
} catch (error) {
  console.error(`Cannot read applied migrations from ${dbUrl.replace(/:[^:@]*@/, ':***@')}`);
  console.error('Start the local stack with `supabase start`, or set SUPABASE_DB_URL.');
  process.exit(2);
}

const missingInDb = repoVersions.filter((v) => !appliedVersions.includes(v));
const missingInRepo = appliedVersions.filter((v) => !repoVersions.includes(v));

console.log(`repo: ${repoVersions.length} migrations, database: ${appliedVersions.length} applied`);

if (missingInRepo.length) {
  console.error('\nApplied to the database but absent from the repository:');
  for (const v of missingInRepo) console.error(`  ${v}`);
  console.error('The schema cannot be rebuilt from source control. Reconstruct these as files.');
}
if (missingInDb.length) {
  console.error('\nIn the repository but not applied:');
  for (const v of missingInDb) console.error(`  ${v}`);
  console.error('Run `supabase db reset` or `supabase db push`.');
}

if (!missingInRepo.length && !missingInDb.length) {
  console.log('No drift.');
  process.exit(0);
}
process.exit(1);
