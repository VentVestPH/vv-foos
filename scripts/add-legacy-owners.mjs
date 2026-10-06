#!/usr/bin/env node
import { supabase, assertTarget } from './local-stack.mjs';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from '../migration/src/csv.mjs';
import { loadZohoUserNames } from '../migration/src/lookups.mjs';

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

const OWNER_COLUMNS = ['Created_By', 'Modified_By'];

const BULK_SOURCES = [
  ['ZohoRecruit_Candidates_p1', ['Candidate_Owner', ...OWNER_COLUMNS], 'sourcer'],
  ['ZohoRecruit_Job_Openings_p1', ['Assigned_Recruiter', 'Account_Manager', ...OWNER_COLUMNS], 'recruiter'],
  ['ZohoRecruit_Applications_paged', ['Application_Owner', 'Assigned_Recruiter', 'Account_Manager', ...OWNER_COLUMNS], 'recruiter'],
  ['ZohoRecruit_Notes_paged', ['Note_Owner', ...OWNER_COLUMNS], 'sourcer'],
  ['ZohoRecruit_Clients_p1', ['Account_Manager', ...OWNER_COLUMNS], 'bd'],
  ['ZohoRecruit_Contacts_p1', ['Contact_Owner', ...OWNER_COLUMNS], 'bd'],
  ['ZohoCRM_Accounts_p1', ['Owner', ...OWNER_COLUMNS], 'bd'],
  ['ZohoCRM_Contacts_p1', ['Owner', ...OWNER_COLUMNS], 'bd'],
  ['ZohoCRM_Leads_p1', ['Owner', ...OWNER_COLUMNS], 'bd'],
  ['ZohoCRM_Notes_p1', ['Owner', ...OWNER_COLUMNS], 'bd'],
];

const BULK_DIR = join(EXPORT_DIR, 'bulk');

const zohoUserNames = loadZohoUserNames(EXPORT_DIR);

function ownerName(value) {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? String(value.name ?? value.id ?? '').trim() : String(value).trim();
  if (/^\d{10,}$/.test(raw)) return zohoUserNames.get(raw) ?? '';
  return raw;
}

function readBulkRecords(dir) {
  const path = join(BULK_DIR, dir);
  if (!existsSync(path)) return [];
  const out = [];
  for (const entry of readdirSync(path).sort()) {
    let records = null;
    if (entry.endsWith('.csv')) {
      records = parseCsvRecords(readFileSync(join(path, entry), 'utf8')).records;
    } else if (entry.endsWith('.json')) {
      records = JSON.parse(readFileSync(join(path, entry), 'utf8'));
    }
    if (!records) continue;
    for (const record of records) out.push(record);
  }
  return out;
}

function url() {
  return assertTarget(process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321', 'api', process.argv.includes('--allow-remote'));
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const env = supabase(['status', '-o', 'env'], { encoding: 'utf8' });
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

for (const [dir, columns, role] of BULK_SOURCES) {
  const records = readBulkRecords(dir);
  for (const row of records) {
    for (const column of columns) {
      const raw = ownerName(row[column]);
      if (!raw) continue;
      if (/^(zrecruit|zcrm)_\d+$/i.test(raw)) continue;
      const norm = raw.toLowerCase();
      if (known.has(norm)) continue;
      const entry = wanted.get(norm) ?? { name: raw, role, rows: 0, files: new Set() };
      entry.rows += 1;
      entry.files.add(dir);
      if (entry.role === 'bd' && role !== 'bd') entry.role = role;
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
