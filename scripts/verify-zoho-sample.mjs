import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseCsvRecords } from '../migration/src/csv.mjs';
import { BULK_ALIASES, buildBulkColumnMap, bulkRowToExportRow } from '../migration/src/bulk-to-export.mjs';
import { mapCandidate } from '../migration/src/map-candidates.mjs';
import { mapRequisition } from '../migration/src/map-requisitions.mjs';
import { loadLookups, newUnresolved } from '../migration/src/lookups.mjs';
import { normalizeZohoId } from '../migration/src/deterministic-id.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const SIZE = Number(valueOf('--size', '12')) || 12;
const EXPORT_DIR = valueOf('--dir', 'migration/zoho-exports');
const DC = process.env.ZOHO_DC ?? 'com';
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const orgId = (v) => (v ?? '').trim().replace(/^org/i, '') || undefined;
const RECRUIT_ORG = orgId(process.env.ZOHO_RECRUIT_ORG_ID);

const ACCOUNTS = `https://accounts.zoho.${DC}`;
const RECRUIT = `https://recruit.zoho.${DC}/recruit/v2`;

if (!CLIENT_ID || !CLIENT_SECRET || !RECRUIT_ORG) {
  console.error(
    'Needs ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_RECRUIT_ORG_ID.\n' +
      'This is the one check that reads Zoho rather than the extracted files, so it\n' +
      'cannot run offline. Every other pass is in scripts/verify-zoho-migration.mjs.',
  );
  process.exit(1);
}

const MODULES = {
  candidates: {
    entity: 'candidate',
    module: 'Candidates',
    aliasKey: 'ZohoRecruit/Candidates',
    uiHeader: 'Candidates_001.csv',
    table: 'people',
    map: (row, lookups, unresolved) => mapCandidate(row, lookups, unresolved).person,
    compare: [
      'first_name',
      'last_name',
      'city',
      'state',
      'country',
      'postal_code',
      'linkedin_public_url',
      'linkedin_recruiter_url',
      'updated_at',
      'created_at',
    ],
  },
  requisitions: {
    entity: 'requisition',
    module: 'Job_Openings',
    aliasKey: 'ZohoRecruit/Job_Openings',
    uiHeader: null,
    table: 'requisitions',
    map: (row, lookups, unresolved) => mapRequisition(row, lookups, unresolved).requisition,
    compare: [
      'title',
      'job_code',
      'status',
      'num_openings',
      'opened_date',
      'pay_notes',
      'employment_type',
      'updated_at',
      'created_at',
    ],
  },
};

async function token() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    soid: `ZohoRecruit.${RECRUIT_ORG}`,
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) throw new Error(`no access token: ${json.error ?? res.status}`);
  return json.access_token;
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const env = execSync('supabase status -o env', { encoding: 'utf8' });
  return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
}

function psql(sql) {
  return execFileSync(
    'psql',
    [
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
      '-F',
      '|',
      '-c',
      sql,
    ],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' } },
  ).trim();
}

function uiColumnMap(spec) {
  if (!spec.uiHeader) return buildBulkColumnMap([]);
  const path = join(EXPORT_DIR, spec.uiHeader);
  if (!existsSync(path)) return buildBulkColumnMap([]);
  return buildBulkColumnMap(parseCsvRecords(readFileSync(path, 'utf8')).header);
}

function bulkHeaderMap(spec) {
  const dir = join(EXPORT_DIR, 'bulk', `ZohoRecruit_${spec.module}_p1`);
  if (!existsSync(dir)) return null;
  const csv = readdirSync(dir).find((f) => f.endsWith('.csv'));
  if (!csv) return null;
  const header = parseCsvRecords(readFileSync(join(dir, csv), 'utf8')).header.map((h) =>
    h.replace(/_/g, ' '),
  );
  return buildBulkColumnMap(header);
}

function normalise(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return String(value);
  const s = String(value).trim();
  if (s === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
    const ms = Date.parse(s);
    if (Number.isNaN(ms)) return s;
    return new Date(Math.floor(ms / 1000) * 1000).toISOString();
  }
  return s;
}

const db = createClient(process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321', serviceKey(), {
  auth: { persistSession: false },
});
const lookups = await loadLookups(db);
const access = await token();

console.log(`\nField-level spot check against the live Zoho API, ${SIZE} record(s) per module\n`);
console.log('This is the only pass that reads Zoho rather than the extracted files, so it is');
console.log('the only one that can catch the extract itself being wrong.\n');

let checked = 0;
let compared = 0;
let mismatched = 0;
const problems = [];

for (const [name, spec] of Object.entries(MODULES)) {
  const rows = psql(
    `select zoho_id, foos_id from zoho_id_map where entity_type = '${spec.entity}'
     order by md5(zoho_id) limit ${SIZE};`,
  );
  const sample = rows
    ? rows.split('\n').map((l) => {
        const [zohoId, foosId] = l.split('|');
        return { zohoId, foosId };
      })
    : [];

  const columnMap = spec.uiHeader ? uiColumnMap(spec) : (bulkHeaderMap(spec) ?? buildBulkColumnMap([]));
  const aliases = BULK_ALIASES[spec.aliasKey] ?? {};

  let moduleMismatch = 0;
  for (const { zohoId, foosId } of sample) {
    const res = await fetch(`${RECRUIT}/${spec.module}/${zohoId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    if (!res.ok) {
      problems.push(`${name} ${zohoId.slice(-6)}: Zoho returned ${res.status}`);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    const live = json.data?.[0];
    if (!live) {
      problems.push(`${name} ${zohoId.slice(-6)}: no record in the response`);
      continue;
    }
    checked += 1;

    const row = { ...live, ...bulkRowToExportRow(live, columnMap, aliases) };
    const expected = spec.map(row, lookups, newUnresolved()) ?? {};

    const { data: actual, error } = await db
      .from(spec.table)
      .select(spec.compare.join(', '))
      .eq('id', foosId)
      .maybeSingle();
    if (error || !actual) {
      problems.push(`${name} ${zohoId.slice(-6)}: no FOOS row (${error?.message ?? 'missing'})`);
      continue;
    }

    for (const field of spec.compare) {
      const want = normalise(expected[field]);
      const got = normalise(actual[field]);
      compared += 1;
      if (want !== got) {
        moduleMismatch += 1;
        mismatched += 1;
        problems.push(
          `${name} ${zohoId.slice(-6)} ${field}: Zoho maps to ${JSON.stringify(want)}, FOOS holds ${JSON.stringify(got)}`,
        );
      }
    }
  }
  console.log(
    `  ${name.padEnd(14)}${String(sample.length).padStart(4)} sampled, ${String(spec.compare.length).padStart(3)} field(s) each, ${moduleMismatch} mismatch(es)`,
  );
}

console.log(`\n  ${checked} record(s) fetched from Zoho, ${compared} field comparison(s), ${mismatched} mismatch(es)`);

if (problems.length === 0) {
  console.log('\nEvery sampled field matches what the live Zoho record maps to.\n');
  process.exit(0);
}
console.log(`\n${problems.length} problem(s):\n`);
for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
console.log('');
process.exit(1);
