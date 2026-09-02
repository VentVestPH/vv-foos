#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from '../migration/src/csv.mjs';

const APPLY = process.argv.includes('--apply');
const SHOW_NAMES = process.argv.includes('--show-names');
const EXPORT_DIR = 'migration/zoho-exports';

const SOURCES = [
  ['Candidates_001.csv', ['Candidate Owner', 'Candidate Owner Id', 'Created By', 'Modified By'], 'sourcer'],
  ['Notes_001.csv', ['Note Owner', 'Created By', 'Modified By'], 'sourcer'],
  ['Attachments_001.csv', ['Attachment Owner', 'Created By', 'Modified By'], 'sourcer'],
  ['crm/Accounts_2026_09_02.csv', ['Account Owner', 'Created By', 'Modified By'], 'bd'],
  ['crm/Contacts_2026_09_02.csv', ['Contact Owner', 'Created By', 'Modified By'], 'bd'],
];

function url() {
  return process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
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

function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function label(name, index) {
  return SHOW_NAMES ? name : `owner ${index + 1}`;
}

const target = url();
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target) && !process.argv.includes('--allow-remote')) {
  console.error(
    `Refusing to write staff rows to ${target}.\n` +
      'Point FOOS_SUPABASE_URL at the local stack, or pass --allow-remote deliberately.',
  );
  process.exit(1);
}

const key = serviceKey();
if (!key) {
  console.error('No service-role key. Set SUPABASE_SERVICE_ROLE_KEY or start the local stack.');
  process.exit(1);
}

const db = createClient(target, key, { auth: { persistSession: false } });

const { data: staffRows, error: staffErr } = await db.from('staff').select('id, full_name, email, is_active');
if (staffErr) {
  console.error(`Could not read staff: ${staffErr.message}`);
  process.exit(1);
}
const known = new Set((staffRows ?? []).map((s) => (s.full_name ?? '').trim().toLowerCase()));

const wanted = new Map();
for (const [file, columns, role] of SOURCES) {
  const path = join(EXPORT_DIR, file);
  if (!existsSync(path)) continue;
  const parsed = parseCsvRecords(readFileSync(path, 'utf8'));
  for (const row of parsed.records) {
    for (const column of columns) {
      const raw = (row[column] ?? '').trim();
      if (!raw) continue;
      if (/^(zrecruit|zcrm)_\d+$/i.test(raw)) continue;
      const norm = raw.toLowerCase();
      if (known.has(norm)) continue;
      const entry = wanted.get(norm) ?? { name: raw, role, rows: 0, files: new Set() };
      entry.rows += 1;
      entry.files.add(file);
      if (entry.role === 'bd' && role === 'sourcer') entry.role = 'sourcer';
      wanted.set(norm, entry);
    }
  }
}

const list = [...wanted.values()].sort((a, b) => b.rows - a.rows);

console.log(`${target}`);
console.log(`${staffRows?.length ?? 0} staff row(s) exist; ${list.length} Zoho owner(s) have none.`);
list.forEach((entry, i) => {
  console.log(
    `  ${label(entry.name, i)}: ${entry.rows} row reference(s) across ${entry.files.size} export(s), proposed role ${entry.role}`,
  );
});

if (!list.length) {
  console.log('Nothing to create.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nDry run. Re-run with --apply to create these as inactive staff rows.');
  console.log('Names are redacted; pass --show-names to print them.');
  process.exit(0);
}

let created = 0;
for (const entry of list) {
  const email = `legacy+${slug(entry.name)}@import.invalid`;
  const { error } = await db
    .from('staff')
    .insert({ full_name: entry.name, email, role: entry.role, is_active: false });
  if (error) {
    console.error(`  failed for ${label(entry.name, 0)}: ${error.message}`);
    continue;
  }
  created += 1;
}
console.log(`\nCreated ${created} inactive staff row(s). Re-run the importer so provenance resolves.`);
