import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const APPLY = has('--apply');
const REMOTE = has('--allow-remote');

const DC = process.env.ZOHO_DC ?? 'com';
const BULK = 'migration/zoho-exports/bulk';
const MODULES = [
  { name: 'Notes', dir: 'ZohoRecruit_Notes_paged', entity: 'note' },
  { name: 'To_Dos', dir: 'ZohoRecruit_To_Dos_paged', entity: 'todo' },
];

const DB_URL =
  process.env.DATABASE_URL_LOCAL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

function psql(sql) {
  return execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function alreadyMapped(ids) {
  if (ids.length === 0) return new Set();
  const list = ids.map((i) => `'${String(i).replace(/'/g, "''")}'`).join(',');
  const rows = psql(`select zoho_id from zoho_id_map where zoho_id in (${list})`);
  return new Set(rows.split('\n').filter(Boolean));
}

async function token() {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    soid: `ZohoRecruit.${process.env.ZOHO_RECRUIT_ORG_ID}`,
  });
  const res = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Zoho refused the client-credentials grant: ${JSON.stringify(json).slice(0, 160)}`);
  }
  return json.access_token;
}

async function get(url, tok) {
  const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${tok}` } });
  if (!res.ok) throw new Error(`${url} answered HTTP ${res.status}`);
  return res.json();
}

const PAGE = 200;

async function newRecords(mod, tok) {
  const base = `https://recruit.zoho.${DC}/recruit/v2/${mod.name}`;
  const found = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `${base}?per_page=${PAGE}&page=${page}&sort_by=Created_Time&sort_order=desc`;
    const body = await get(url, tok);
    const rows = body.data ?? [];
    if (rows.length === 0) return found;
    const mapped = alreadyMapped(rows.map((r) => r.id));
    const unseen = rows.filter((r) => !mapped.has(String(r.id)));
    found.push(...unseen);
    if (unseen.length < rows.length) return found;
  }
  console.warn(`  ${mod.name}: 10 pages of unmapped records, stopping. Run a full pull instead.`);
  return found;
}

const liveCount = async (mod, tok) =>
  (await get(`https://recruit.zoho.${DC}/recruit/v2/${mod.name}/actions/count`, tok)).count;

async function main() {
  for (const v of ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_RECRUIT_ORG_ID']) {
    if (!process.env[v]) {
      console.error(`${v} is not set. Source the root .env first.`);
      process.exit(1);
    }
  }

  console.log(`zoho_id_map holds ${Number(psql('select count(*) from zoho_id_map')).toLocaleString()} ids`);

  const tok = await token();
  const staged = [];

  for (const mod of MODULES) {
    const count = await liveCount(mod, tok);
    const rows = await newRecords(mod, tok);
    console.log(`  ${mod.name}: ${count.toLocaleString()} live, ${rows.length} not yet imported`);
    if (rows.length > 0) staged.push({ mod, rows });
  }

  if (staged.length === 0) {
    console.log('Nothing new. Both products already match.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to import.');
    for (const { mod, rows } of staged) {
      for (const r of rows) console.log(`  ${mod.name} ${r.id} ${r.Created_Time ?? ''}`);
    }
    return;
  }

  const restore = [];
  try {
    for (const { mod, rows } of staged) {
      const path = join(BULK, mod.dir, `${mod.name}.json`);
      const backup = `${path}.full`;
      if (existsSync(path)) {
        copyFileSync(path, backup);
        restore.push([backup, path]);
      }
      writeFileSync(path, JSON.stringify(rows));
    }

    const entities = staged.map(({ mod }) => `${mod.entity}s`).join(',');
    const argv = ['migration/import.mjs', '--entity', entities, '--apply'];
    if (REMOTE) argv.push('--allow-remote');
    console.log(`\nnode ${argv.join(' ')}`);
    execFileSync('node', argv, { stdio: 'inherit' });
  } finally {
    for (const [backup, path] of restore) {
      copyFileSync(backup, path);
      unlinkSync(backup);
    }
    console.log('\nFull export files restored.');
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
