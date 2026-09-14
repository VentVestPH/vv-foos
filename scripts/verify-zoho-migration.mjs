import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

function psqlScript(sql) {
  const file = join(SCRATCH, 'verify-step.sql');
  writeFileSync(file, sql);
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-f', file], {
    encoding: 'utf8',
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? 'postgres' },
    maxBuffer: 1024 * 1024 * 512,
  }).trim();
}

const BULK = 'migration/zoho-exports/bulk';
const SCRATCH = resolve(process.env.FOOS_VERIFY_TMP ?? '.verify');
mkdirSync(SCRATCH, { recursive: true });

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

console.log('\nPASS 3  every FOOS row is imported, seed or trigger-derived, nothing unaccounted\n');
const OWN_IS_TEST = 't.is_test';

const PARENT_IS_TEST_APPLICATIONS = `(
  exists (select 1 from requisitions r where r.id = t.requisition_id and r.is_test)
  or exists (select 1 from people p where p.id = t.person_id and p.is_test)
)`;

const PARENT_IS_TEST_ACTIVITIES = `(
  exists (select 1 from people p where p.id = t.person_id and p.is_test)
  or exists (select 1 from companies c where c.id = t.company_id and c.is_test)
  or exists (select 1 from requisitions r where r.id = t.requisition_id and r.is_test)
  or exists (select 1 from applications a
             join requisitions r on r.id = a.requisition_id
             where a.id = t.application_id and r.is_test)
  or exists (select 1 from deals d where d.id = t.deal_id and d.is_test)
)`;

const DERIVED_NONE = 'false';
const DERIVED_ACTIVITIES = "t.kind = 'status_change'";

const TABLES = [
  ['people', "entity_type in ('candidate','contact','lead')", OWN_IS_TEST, DERIVED_NONE],
  ['companies', "entity_type = 'company'", OWN_IS_TEST, DERIVED_NONE],
  ['requisitions', "entity_type = 'requisition'", OWN_IS_TEST, DERIVED_NONE],
  ['applications', "entity_type = 'application'", PARENT_IS_TEST_APPLICATIONS, DERIVED_NONE],
  ['activities', "entity_type = 'note'", PARENT_IS_TEST_ACTIVITIES, DERIVED_ACTIVITIES],
];
console.log(
  `  ${'table'.padEnd(16)}${'rows'.padStart(9)}${'imported'.padStart(10)}${'seed'.padStart(7)}${'derived'.padStart(9)}${'other'.padStart(8)}`,
);
for (const [table, pred, seedExpr, derivedExpr] of TABLES) {
  const row = psql(`
    select count(*),
           count(*) filter (where m.foos_id is not null),
           count(*) filter (where ${seedExpr}),
           count(*) filter (where m.foos_id is null and not ${seedExpr} and ${derivedExpr}),
           count(*) filter (where m.foos_id is null and not ${seedExpr} and not ${derivedExpr})
    from public.${table} t
    left join (select distinct foos_id from zoho_id_map where ${pred}) m
      on m.foos_id = t.id;
  `);
  const [total, imported, seed, derived, other] = row.split('|');
  console.log(
    `  ${table.padEnd(16)}${total.padStart(9)}${imported.padStart(10)}${seed.padStart(7)}${derived.padStart(9)}${other.padStart(8)}`,
  );
  if (Number(other) > 0) {
    fail(`${table}: ${other} row(s) are neither imported, seed, nor trigger-derived`);
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
];
for (const [label, sql] of CHECKS) {
  const n = psql(sql);
  const ok = n === '0';
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)}${n.padStart(8)}`);
  if (!ok) fail(`${label}: ${n}`);
}

console.log('\nPASS 5  timestamp fidelity, every extracted record and not a sample\n');
{
  const TIMESTAMPS = [
    ['candidate', 'people', 'ZohoRecruit_Candidates_p1'],
    ['requisition', 'requisitions', 'ZohoRecruit_Job_Openings_p1'],
    ['company', 'companies', 'ZohoRecruit_Clients_p1'],
  ];
  for (const [entity, table, dir] of TIMESTAMPS) {
    const path = join(BULK, dir);
    const csv = existsSync(path) ? readdirSync(path).find((f) => f.endsWith('.csv')) : null;
    if (!csv) {
      fail(`${dir} extract missing, cannot check timestamp fidelity`);
      continue;
    }
    const records = parseCsvRecords(readFileSync(join(path, csv), 'utf8')).records;
    const rows = [];
    for (const r of records) {
      const id = normalizeZohoId(r.Id ?? r.id);
      const mod = String(r.Modified_Time ?? r.Updated_On ?? '').trim();
      if (id && mod) rows.push(`${id}\t${mod}`);
    }
    const tsv = join(SCRATCH, `${entity}-timestamps.tsv`);
    writeFileSync(tsv, `${rows.join('\n')}\n`);

    const out = psqlScript(`
create temporary table zoho_ts (zoho_id text, modified timestamptz);
\\copy zoho_ts from '${tsv}' with (format text)
select count(*),
             count(*) filter (
               where date_trunc('second', t.updated_at) = date_trunc('second', z.modified)
             )
      from zoho_ts z
      join zoho_id_map m on m.zoho_id = z.zoho_id and m.entity_type = '${entity}'
      join public.${table} t on t.id = m.foos_id;
    `);
    const line = out.trim().split('\n').filter((l) => l.includes('|')).pop() ?? '0|0';
    const [checked, matching] = line.split('|');
    const drift = Number(checked) - Number(matching);
    console.log(
      `  ${entity.padEnd(12)}${String(checked).padStart(8)} compared, ${String(matching).padStart(8)} match Zoho Modified_Time, ${drift} drifted`,
    );
    if (Number(checked) !== rows.length) {
      fail(`${entity}: only ${checked} of ${rows.length} extracted rows could be joined to a FOOS row`);
    }
    if (drift > 0) fail(`${entity}: ${drift} row(s) have an updated_at that is not the Zoho value`);
  }
}

console.log('\nPASS 6  attachment bytes are in Storage, not just metadata\n');
{
  const manifestPath = join('migration/zoho-exports', 'attachments-manifest.json');
  if (!existsSync(manifestPath)) {
    console.log('  no attachment manifest on disk, so nothing to check');
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const identity = manifest.filter((m) => m.identity).length;
    const bucketLimit = Number(
      psql("select coalesce(file_size_limit, 0) from storage.buckets where id = 'attachments'"),
    );
    const overLimit = manifest.filter(
      (m) => !m.identity && bucketLimit > 0 && (m.sizeBytes ?? 0) > bucketLimit,
    );
    const wanted = manifest.filter(
      (m) => !m.identity && !(bucketLimit > 0 && (m.sizeBytes ?? 0) > bucketLimit),
    );

    const rows = psql(`
      select count(*) filter (where storage_path not like 'zoho-import/pending/%'),
             count(*) filter (where storage_path like 'zoho-import/pending/%'),
             (select count(*) from storage.objects
               where bucket_id = 'attachments'
                 and name like 'zoho-import/%'
                 and name not like 'zoho-import/pending/%'),
             count(*) filter (where storage_path not like 'zoho-import/pending/%' and file_size_bytes is null)
      from public.attachments;
    `);
    const [withBytes, pendingRows, storageObjects, missingSize] = rows.split('|').map(Number);

    console.log(`  enumerated in Zoho                                    ${manifest.length}`);
    console.log(`  identity documents held back                          ${identity}`);
    console.log(`  over the bucket's ${(bucketLimit / 1048576).toFixed(0)} MB limit                           ${overLimit.length}`);
    console.log(`  therefore expected in Storage                         ${wanted.length}`);
    console.log(`  attachment rows pointing at real bytes                ${withBytes}`);
    console.log(`  objects actually in the bucket                        ${storageObjects}`);
    console.log(`  metadata-only rows from the old CSV export            ${pendingRows}`);

    if (withBytes !== storageObjects) {
      fail(
        `${withBytes} attachment row(s) claim real bytes but the bucket holds ${storageObjects} object(s); a row pointing at a missing file is worse than no row`,
      );
    }
    if (missingSize > 0) {
      fail(`${missingSize} attachment row(s) have bytes but no file_size_bytes`);
    }
    if (withBytes < wanted.length) {
      fail(
        `${wanted.length - withBytes} attachment(s) are enumerated in Zoho, within the bucket limit, and not in Storage`,
      );
    }

    const duplicatePlaceholders = Number(
      psql(`
        select count(*)
        from public.attachments p
        where p.storage_path like 'zoho-import/pending/%'
          and exists (
            select 1 from public.attachments r
            where r.storage_path not like 'zoho-import/pending/%'
              and r.parent_id = p.parent_id
              and r.parent_type = p.parent_type
              and r.storage_path like '%' || split_part(split_part(p.storage_path, '/', 3), '_', 1) || '%'
          );
      `),
    );
    console.log(`  placeholders whose file has since arrived             ${duplicatePlaceholders}`);
    if (duplicatePlaceholders > 0) {
      fail(
        `${duplicatePlaceholders} attachment row(s) still say "File not yet available" for a file that is in Storage on the same parent; the record screen shows the working file and a dead placeholder side by side`,
      );
    }
  }
}

console.log('\nPASS 7  triggers are back on\n');
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
