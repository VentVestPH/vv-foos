import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from '../migration/src/csv.mjs';
import { normalizeZohoId } from '../migration/src/deterministic-id.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const DB_URL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

function isLocal(u) {
  return /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(u);
}
if (!isLocal(DB_URL) && !has('--allow-remote')) {
  console.error(`Refusing to read ${DB_URL.replace(/:[^:@]*@/, ':***@')} without --allow-remote.`);
  process.exit(1);
}

function psql(sql) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' },
    maxBuffer: 1024 * 1024 * 512,
  }).trim();
}

const BULK = 'migration/zoho-exports/bulk';

const MODULES = [
  { label: 'Recruit/Candidates', dir: 'ZohoRecruit_Candidates_p1', entity: 'candidate' },
  { label: 'Recruit/Job_Openings', dir: 'ZohoRecruit_Job_Openings_p1', entity: 'requisition' },
  { label: 'Recruit/Applications', dir: 'ZohoRecruit_Applications_paged', entity: 'application' },
  { label: 'Recruit/Notes', dir: 'ZohoRecruit_Notes_paged', entity: 'note' },
  { label: 'Recruit/Clients', dir: 'ZohoRecruit_Clients_p1', entity: 'company' },
  { label: 'Recruit/Contacts', dir: 'ZohoRecruit_Contacts_p1', entity: 'contact' },
  {
    label: 'Recruit/Departments',
    dir: 'ZohoRecruit_Departments_paged',
    entity: 'company',
    aliasOf: 'Recruit/Clients',
  },
  { label: 'CRM/Accounts', dir: 'ZohoCRM_Accounts_p1', entity: 'company' },
  { label: 'CRM/Contacts', dir: 'ZohoCRM_Contacts_p1', entity: 'contact' },
  { label: 'CRM/Leads', dir: 'ZohoCRM_Leads_p1', entity: 'lead' },
  { label: 'CRM/Notes', dir: 'ZohoCRM_Notes_p1', entity: 'note' },
];

function extractedIds(dir) {
  const path = join(BULK, dir);
  if (!existsSync(path)) return null;
  const entries = readdirSync(path).sort();
  const ids = [];
  const seen = new Set();
  const push = (raw) => {
    const id = normalizeZohoId(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  let files = 0;
  for (const entry of entries) {
    if (entry.endsWith('.csv')) {
      files += 1;
      for (const r of parseCsvRecords(readFileSync(join(path, entry), 'utf8')).records) {
        push(r.Id ?? r.id);
      }
    } else if (entry.endsWith('.json')) {
      files += 1;
      for (const r of JSON.parse(readFileSync(join(path, entry), 'utf8'))) push(r.Id ?? r.id);
    }
  }
  return files === 0 ? null : ids;
}

const problems = [];
const fail = (m) => problems.push(m);

console.log('\nZoho migration verification\n');

const mapRows = psql(
  "select entity_type, zoho_id from zoho_id_map where entity_type <> '' order by entity_type",
);
const mapped = new Map();
for (const line of mapRows ? mapRows.split('\n') : []) {
  const i = line.indexOf('|');
  const entity = line.slice(0, i);
  const zohoId = normalizeZohoId(line.slice(i + 1));
  if (!mapped.has(entity)) mapped.set(entity, new Set());
  mapped.get(entity).add(zohoId);
}

console.log('PASS 1  every extracted Zoho record has a mapping row\n');
console.log(
  `  ${'module'.padEnd(24)}${'extracted'.padStart(10)}${'mapped'.padStart(9)}${'missing'.padStart(9)}`,
);

const extracted = new Map();
for (const m of MODULES) {
  const ids = extractedIds(m.dir);
  extracted.set(m.label, ids);
  if (ids === null) {
    console.log(`  ${m.label.padEnd(24)}${'-'.padStart(10)}`);
    fail(`${m.label}: no extract on disk`);
    continue;
  }
  const set = mapped.get(m.entity) ?? new Set();
  const missing = ids.filter((id) => !set.has(id));
  const flag = m.aliasOf ? ` (alias of ${m.aliasOf})` : '';
  console.log(
    `  ${m.label.padEnd(24)}${String(ids.length).padStart(10)}${String(ids.length - missing.length).padStart(9)}${String(missing.length).padStart(9)}${flag}`,
  );
  if (missing.length > 0) fail(`${m.label}: ${missing.length} extracted record(s) not mapped`);
}

console.log('\nPASS 2  Departments really is the same record set as Clients\n');
{
  const cl = extracted.get('Recruit/Clients');
  const dp = extracted.get('Recruit/Departments');
  if (!cl || !dp) {
    fail('cannot compare Departments to Clients: one extract is missing');
  } else {
    const clSet = new Set(cl);
    const only = dp.filter((id) => !clSet.has(id));
    console.log(`  clients ${cl.length}   departments ${dp.length}   departments-only ${only.length}`);
    if (only.length > 0) {
      fail(
        `Departments holds ${only.length} record(s) absent from Clients, so it is a distinct module and needs its own mapper`,
      );
    } else {
      console.log('  Departments is a second API name over the Clients module. Nothing extra to import.');
    }
  }
}

console.log('\nPASS 3  every FOOS row is either imported or seed, nothing unaccounted\n');
const TABLES = [
  ['people', "entity_type in ('candidate','contact','lead')"],
  ['companies', "entity_type = 'company'"],
  ['requisitions', "entity_type = 'requisition'"],
  ['applications', "entity_type = 'application'"],
  ['activities', "entity_type = 'note'"],
];
console.log(
  `  ${'table'.padEnd(16)}${'rows'.padStart(9)}${'imported'.padStart(10)}${'seed'.padStart(7)}${'other'.padStart(8)}`,
);
for (const [table, pred] of TABLES) {
  const hasIsTest = psql(
    `select count(*) from information_schema.columns where table_name='${table}' and column_name='is_test'`,
  );
  const seedExpr = hasIsTest === '1' ? 'is_test' : 'false';
  const row = psql(`
    with m as (select foos_id from zoho_id_map where ${pred})
    select count(*),
           count(*) filter (where t.id in (select foos_id from m)),
           count(*) filter (where ${seedExpr}),
           count(*) filter (where t.id not in (select foos_id from m) and not ${seedExpr})
    from public.${table} t;
  `);
  const [total, imported, seed, other] = row.split('|');
  console.log(
    `  ${table.padEnd(16)}${total.padStart(9)}${imported.padStart(10)}${seed.padStart(7)}${other.padStart(8)}`,
  );
  if (Number(other) > 0) {
    fail(`${table}: ${other} row(s) are neither imported nor seed`);
  }
}

console.log('\nPASS 4  referential integrity and mapping sanity\n');
const CHECKS = [
  [
    'zoho ids mapped to the same FOOS row',
    `select count(*) from (select entity_type, foos_id from zoho_id_map group by 1,2 having count(*) > 1) d`,
  ],
  [
    'imported requisitions with no company',
    `select count(*) from requisitions r join zoho_id_map m on m.foos_id = r.id and m.entity_type='requisition' where r.company_id is null`,
  ],
  [
    'imported applications with an unimported person',
    `select count(*) from applications a join zoho_id_map m on m.foos_id = a.id and m.entity_type='application'
     where not exists (select 1 from zoho_id_map p where p.foos_id = a.person_id and p.entity_type='candidate')`,
  ],
  [
    'imported applications with an unimported requisition',
    `select count(*) from applications a join zoho_id_map m on m.foos_id = a.id and m.entity_type='application'
     where not exists (select 1 from zoho_id_map q where q.foos_id = a.requisition_id and q.entity_type='requisition')`,
  ],
  [
    'imported activities attached to nothing',
    `select count(*) from activities a join zoho_id_map m on m.foos_id = a.id and m.entity_type='note'
     where a.person_id is null and a.company_id is null and a.application_id is null
       and a.requisition_id is null and a.deal_id is null`,
  ],
  [
    'imported people with no profile row',
    `select count(*) from people p join zoho_id_map m on m.foos_id = p.id and m.entity_type in ('candidate','contact','lead')
     where not exists (select 1 from candidate_profiles c where c.person_id = p.id)
       and not exists (select 1 from contact_profiles k where k.person_id = p.id)`,
  ],
  [
    'applications whose stage fell back to talent_pool',
    `select count(*) from applications where stage = 'talent_pool' and coalesce(source_status,'') not ilike 'talent pool'`,
  ],
  [
    'imported candidates with a placeholder updated_at (today)',
    `select count(*) from people p join zoho_id_map m on m.foos_id = p.id and m.entity_type='candidate'
     where p.updated_at::date = current_date`,
  ],
];
for (const [label, sql] of CHECKS) {
  const n = psql(sql);
  const ok = n === '0';
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)}${n.padStart(8)}`);
  if (!ok) fail(`${label}: ${n}`);
}

console.log('\nPASS 5  timestamp fidelity against the extract\n');
{
  const candidateFile = join(BULK, 'ZohoRecruit_Candidates_p1');
  const csv = existsSync(candidateFile)
    ? readdirSync(candidateFile).find((f) => f.endsWith('.csv'))
    : null;
  if (!csv) {
    fail('candidate extract missing, cannot check timestamp fidelity');
  } else {
    const records = parseCsvRecords(readFileSync(join(candidateFile, csv), 'utf8')).records;
    const sample = [];
    const step = Math.max(1, Math.floor(records.length / 200));
    for (let i = 0; i < records.length && sample.length < 200; i += step) {
      const r = records[i];
      const id = normalizeZohoId(r.Id ?? r.id);
      const mod = String(r.Modified_Time ?? r.Updated_On ?? '').trim();
      if (id && mod) sample.push([id, mod]);
    }
    const values = sample.map(([id, mod]) => `('${id}', '${mod}'::timestamptz)`).join(',');
    const row = psql(`
      with s(zoho_id, modified) as (values ${values})
      select count(*),
             count(*) filter (where date_trunc('second', p.updated_at) = date_trunc('second', s.modified))
      from s
      join zoho_id_map m on m.zoho_id = s.zoho_id and m.entity_type = 'candidate'
      join people p on p.id = m.foos_id;
    `);
    const [checked, matching] = row.split('|');
    console.log(`  candidates sampled ${checked}, updated_at matching Zoho Modified_Time ${matching}`);
    if (checked !== matching) {
      fail(`${Number(checked) - Number(matching)} of ${checked} sampled candidates have a drifted updated_at`);
    }
  }
}

console.log('\nPASS 6  triggers are back on\n');
{
  const out = psql(`
    select count(*) filter (where t.tgenabled = 'D')
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal
      and c.relname in ('people','companies','requisitions','applications',
                        'candidate_profiles','contact_profiles','activities','attachments');
  `);
  console.log(`  disabled triggers: ${out}`);
  if (out !== '0') fail(`${out} trigger(s) still disabled; run scripts/bulk-load-triggers.mjs --enable`);
}

if (problems.length === 0) {
  console.log('\nAll passes clean.\n');
  process.exit(0);
}
console.log(`\n${problems.length} problem(s):\n`);
for (const p of problems) console.log(`  - ${p}`);
console.log('');
process.exit(1);
