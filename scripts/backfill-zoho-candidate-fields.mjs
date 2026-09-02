#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from '../migration/src/csv.mjs';
import { parsePartialDate, parseStarGrade } from '../migration/src/zoho.mjs';

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');
const CANDIDATES = join('migration/zoho-exports', 'Candidates_001.csv');

const target = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target);
if (!isLocal && !ALLOW_REMOTE) {
  console.error(
    `Refusing to write to ${target}.\n` +
      'Run the dry run first, review the counts, then pass --allow-remote deliberately.',
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
if (!existsSync(CANDIDATES)) {
  console.error(`Missing ${CANDIDATES}. This backfill reads the Zoho export, not the database.`);
  process.exit(1);
}

const db = createClient(target, key, { auth: { persistSession: false } });

const { data: mappings, error: mapErr } = await db
  .from('zoho_id_map')
  .select('zoho_id, foos_id')
  .eq('entity_type', 'candidate');
if (mapErr) {
  console.error(`Could not read zoho_id_map: ${mapErr.message}`);
  process.exit(1);
}
const personByZohoId = new Map((mappings ?? []).map((m) => [m.zoho_id, m.foos_id]));

const { data: profiles, error: profErr } = await db
  .from('candidate_profiles')
  .select('person_id, star_grade, initial_date');
if (profErr) {
  console.error(`Could not read candidate_profiles: ${profErr.message}`);
  process.exit(1);
}
const profileByPerson = new Map((profiles ?? []).map((p) => [p.person_id, p]));

const file = parseCsvRecords(readFileSync(CANDIDATES, 'utf8'));

const counts = {
  sourceRows: file.records.length,
  mapped: 0,
  unmapped: 0,
  noProfile: 0,
  gradeWouldSet: 0,
  gradeWouldChange: 0,
  gradeAlreadyRight: 0,
  gradeUnparseable: 0,
  dateWouldSet: 0,
  dateWouldChange: 0,
  dateAlreadyRight: 0,
  dateUnparseable: 0,
  written: 0,
  failed: 0,
};

for (const row of file.records) {
  const zohoId = (row['Candidate Id'] ?? row['Record Id'] ?? '').trim();
  const personId = zohoId ? personByZohoId.get(zohoId) : null;
  if (!personId) {
    counts.unmapped += 1;
    continue;
  }
  counts.mapped += 1;
  const profile = profileByPerson.get(personId);
  if (!profile) {
    counts.noProfile += 1;
    continue;
  }

  const patch = {};

  const rating = parseStarGrade(row['Rating']);
  if (rating.grade === null) {
    if (rating.reason && rating.reason !== 'empty') counts.gradeUnparseable += 1;
  } else if (profile.star_grade === null) {
    counts.gradeWouldSet += 1;
    patch.star_grade = rating.grade;
  } else if (profile.star_grade !== rating.grade) {
    counts.gradeWouldChange += 1;
    patch.star_grade = rating.grade;
  } else {
    counts.gradeAlreadyRight += 1;
  }

  const rawDate = (row['Initial Date'] ?? '').trim();
  const initialDate = parsePartialDate(rawDate, row['Created Time']);
  if (rawDate && !initialDate) {
    counts.dateUnparseable += 1;
  } else if (initialDate) {
    if (profile.initial_date === null) {
      counts.dateWouldSet += 1;
      patch.initial_date = initialDate;
    } else if (profile.initial_date !== initialDate) {
      counts.dateWouldChange += 1;
      patch.initial_date = initialDate;
    } else {
      counts.dateAlreadyRight += 1;
    }
  }

  if (!APPLY || Object.keys(patch).length === 0) continue;

  const { error } = await db.from('candidate_profiles').update(patch).eq('person_id', personId);
  if (error) {
    counts.failed += 1;
    console.error(`  update failed for one row: ${error.message}`);
  } else {
    counts.written += 1;
  }
}

console.log(`${APPLY ? 'Backfill' : 'Backfill dry run'} against ${target}`);
console.log(`  source rows            ${counts.sourceRows}`);
console.log(`  matched via zoho_id_map ${counts.mapped}  (unmapped ${counts.unmapped}, no profile ${counts.noProfile})`);
console.log(`  star_grade   set ${counts.gradeWouldSet}  corrected ${counts.gradeWouldChange}  already right ${counts.gradeAlreadyRight}  unparseable ${counts.gradeUnparseable}`);
console.log(`  initial_date set ${counts.dateWouldSet}  corrected ${counts.dateWouldChange}  already right ${counts.dateAlreadyRight}  unparseable ${counts.dateUnparseable}`);
if (APPLY) console.log(`  rows written ${counts.written}, failed ${counts.failed}`);
else console.log('  Nothing written. Re-run with --apply.');
