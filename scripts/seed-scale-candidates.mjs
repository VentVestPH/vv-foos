import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const MARKER = 'ScaleProbe';
const COUNT = Number(valueOf('--count', '70200'));
const BATCH = Number(valueOf('--batch', '2000'));

const ID_CHUNK = 200;

function envFrom(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
        .map((l) => {
          const i = l.indexOf('=');
          return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...envFrom('.env'), ...envFrom('tests/.env'), ...process.env };
const target = env.FOOS_SUPABASE_URL ?? env.SUPABASE_URL ?? 'http://127.0.0.1:55321';
let key = env.SUPABASE_SERVICE_ROLE_KEY;

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target);
if (!key && isLocal) {
  try {
    const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' }));
    key = status.SERVICE_ROLE_KEY;
  } catch {
    key = undefined;
  }
}

if (!isLocal && !has('--allow-remote')) {
  console.error(
    `Refusing to run against ${target}.\n` +
      'This inserts tens of thousands of rows. Point FOOS_SUPABASE_URL at the local stack,\n' +
      'or pass --allow-remote deliberately.',
  );
  process.exit(1);
}
if (!key) {
  console.error(
    'No service-role key. Set SUPABASE_SERVICE_ROLE_KEY in .env, or start the local\n' +
      'stack so it can be read from `supabase status -o json`.',
  );
  process.exit(1);
}

const sb = createClient(target, key, { auth: { persistSession: false } });

async function countProbes() {
  const { count, error } = await sb
    .from('people')
    .select('id', { count: 'exact', head: true })
    .like('first_name', `${MARKER}%`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function purge() {
  let removed = 0;
  for (;;) {
    const { data, error } = await sb
      .from('people')
      .select('id')
      .like('first_name', `${MARKER}%`)
      .limit(BATCH);
    if (error) throw new Error(error.message);
    if (!data.length) break;
    const ids = data.map((r) => r.id);
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
      const slice = ids.slice(i, i + ID_CHUNK);
      const prof = await sb.from('candidate_profiles').delete().in('person_id', slice);
      if (prof.error) throw new Error(`candidate_profiles: ${prof.error.message}`);
      const ppl = await sb.from('people').delete().in('id', slice);
      if (ppl.error) throw new Error(`people: ${ppl.error.message}`);
      removed += slice.length;
    }
    process.stdout.write(`\r  purged ${removed}`);
  }
  process.stdout.write(`\r  purged ${removed}\n`);
  const left = await countProbes();
  if (left > 0) throw new Error(`${left} probe row(s) survived the purge`);
  return removed;
}

if (has('--purge')) {
  console.log(`Purging ${MARKER} rows from ${target}`);
  await purge();
  console.log('done. No probe rows remain.');
  process.exit(0);
}

const existing = await countProbes();
if (existing > 0) {
  console.error(
    `${existing} ${MARKER} row(s) already exist. Run with --purge first, so a scale run\n` +
      'never measures a table it has quietly doubled.',
  );
  process.exit(1);
}

const CITIES = ['Manila', 'Cebu', 'Davao', 'Singapore'];
const REGIONS = ['NCR', 'Central Visayas', 'Davao Region', 'SG'];
const TITLES = ['Engineer', 'Designer', 'Analyst', 'Recruiter'];

console.log(`Seeding ${COUNT} probe candidates into ${target} in batches of ${BATCH}`);
const started = Date.now();
let made = 0;

for (let i = 0; i < COUNT; i += BATCH) {
  const size = Math.min(BATCH, COUNT - i);
  const people = Array.from({ length: size }, (_, k) => {
    const n = i + k;
    return {
      first_name: `${MARKER}${n}`,
      last_name: `Row${n % 997}`,
      city: CITIES[n % CITIES.length],
      state: REGIONS[n % REGIONS.length],
      country: 'PH',
      emails: [{ type: 'work', address: `probe${n}@probe.invalid` }],
      is_test: true,
    };
  });

  const { data, error } = await sb.from('people').insert(people).select('id');
  if (error) {
    console.error(`\npeople insert failed at ${made}: ${error.message}`);
    process.exit(1);
  }

  const profiles = data.map((row, k) => {
    const n = i + k;
    const day = n % 900;
    return {
      person_id: row.id,
      current_title: TITLES[n % TITLES.length],
      current_employer: `Employer ${n % 500}`,
      star_grade: 1 + (n % 3),
      initial_date: new Date(Date.now() - day * 86400000).toISOString().slice(0, 10),
    };
  });

  const prof = await sb.from('candidate_profiles').insert(profiles);
  if (prof.error) {
    console.error(`\ncandidate_profiles insert failed at ${made}: ${prof.error.message}`);
    process.exit(1);
  }

  made += size;
  process.stdout.write(`\r  ${made} of ${COUNT}`);
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\r  ${made} of ${COUNT}, in ${seconds}s`);
console.log(`
Seeded. star_grade is 1 to 3, which the candidate_profiles check constraint enforces;
a wider range fails after the people rows have already committed.

Measure, then remove them again:

  node scripts/seed-scale-candidates.mjs --purge
`);
