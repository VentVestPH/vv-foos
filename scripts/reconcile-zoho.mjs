import { execFileSync } from 'node:child_process';
import { assertTarget } from './local-stack.mjs';
import { normalizeZohoId } from '../migration/src/deterministic-id.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const USAGE = `Usage: node scripts/reconcile-zoho.mjs --entity <name[,name]|all> [--allow-remote] [--budget N]

Read-only. For each entity it lists every id Zoho holds and every id zoho_id_map holds,
then prints the ids Zoho has that FOOS lacks (missing) and the ids FOOS holds that Zoho no
longer serves (deleted upstream; FOOS keeps those by design).

Entities: candidate requisition application company contact lead note todo review
          calendlyInvite crmTask crmEvent

  --budget N    API calls allowed, default 400. The run refuses up front when the
                estimate (records / 200 per module) is over it. note costs about 1,060.
  --allow-remote  read DATABASE_URL instead of the local database`;

const KNOWN = new Set(['--entity', '--allow-remote', '--budget', '--help']);
const unknown = args.filter((a) => a.startsWith('-') && !KNOWN.has(a));
if (has('--help') || unknown.length > 0 || !valueOf('--entity', null)) {
  const bad = unknown.length > 0 ? `Unknown flag ${unknown.join(', ')}.\n\n` : '';
  console[has('--help') ? 'log' : 'error'](bad + USAGE);
  process.exit(has('--help') ? 0 : 1);
}

const R = 'ZohoRecruit';
const C = 'ZohoCRM';
const ENTITIES = {
  candidate: [[R, 'Candidates']],
  requisition: [[R, 'Job_Openings']],
  application: [[R, 'Applications']],
  company: [[R, 'Clients'], [C, 'Accounts']],
  contact: [[R, 'Contacts'], [C, 'Contacts']],
  lead: [[C, 'Leads']],
  note: [[R, 'Notes'], [C, 'Notes'], [C, 'Leads']],
  todo: [[R, 'To_Dos']],
  review: [[R, 'Reviews']],
  calendlyInvite: [[R, 'Calendly_Invites']],
  crmTask: [[C, 'Tasks']],
  crmEvent: [[C, 'Events']],
};

const wanted = valueOf('--entity', '').split(',').flatMap((e) => (e === 'all' ? Object.keys(ENTITIES) : [e.trim()]));
for (const e of wanted) {
  if (!ENTITIES[e]) {
    console.error(`Unknown entity "${e}".\n\n${USAGE}`);
    process.exit(1);
  }
}

const BUDGET = Number(valueOf('--budget', '400'));
const DC = (process.env.ZOHO_DC ?? 'com').trim();
const orgId = (v) => (v ?? '').trim().replace(/^org/i, '');
const PRODUCTS = {
  [R]: {
    org: orgId(process.env.ZOHO_RECRUIT_ORG_ID),
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    count: (m) => `https://recruit.zoho.${DC}/recruit/v2/${m}/actions/count`,
    list: (m, page) => `https://recruit.zoho.${DC}/recruit/v2/${m}?per_page=200&page=${page}`,
  },
  [C]: {
    org: orgId(process.env.ZOHO_CRM_ORG_ID),
    scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ',
    count: (m) => `https://www.zohoapis.${DC}/crm/v7/${m}/actions/count`,
    list: (m, page) => `https://www.zohoapis.${DC}/crm/v7/${m}?fields=id&per_page=200&page=${page}`,
  },
};

const clientId = (process.env.ZOHO_CLIENT_ID ?? '').trim();
const clientSecret = (process.env.ZOHO_CLIENT_SECRET ?? '').trim();
if (!clientId || !clientSecret || !PRODUCTS[R].org || !PRODUCTS[C].org) {
  console.error('Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_RECRUIT_ORG_ID and ZOHO_CRM_ORG_ID.');
  process.exit(1);
}

const DB_URL = assertTarget(
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:56322/postgres',
  'db',
  has('--allow-remote'),
);
if (!has('--allow-remote') && !/127\.0\.0\.1|localhost/.test(DB_URL)) {
  console.error('Refusing to read a remote database without --allow-remote.');
  process.exit(1);
}

let calls = 0;
const tokens = new Map();

async function token(product) {
  const cached = tokens.get(product);
  if (cached && Date.now() < cached.expiry - 60000) return cached.value;
  const res = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: PRODUCTS[product].scope,
      soid: `${product}.${PRODUCTS[product].org}`,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!json?.access_token) throw new Error(`${product} token request failed: ${JSON.stringify(json)}`);
  tokens.set(product, { value: json.access_token, expiry: Date.now() + Number(json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

async function zoho(product, url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    calls += 1;
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${await token(product)}` } });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    return res;
  }
  throw new Error(`gave up after 5 attempts on ${url}`);
}

async function moduleCount(product, moduleName) {
  const res = await zoho(product, PRODUCTS[product].count(moduleName));
  const json = await res.json().catch(() => null);
  const n = Number(json?.count);
  if (!Number.isFinite(n)) throw new Error(`no count for ${product}/${moduleName}`);
  return n;
}

async function zohoIds(product, moduleName) {
  const ids = new Set();
  for (let page = 1; ; page += 1) {
    const res = await zoho(product, PRODUCTS[product].list(moduleName, page));
    if (res.status === 204) break;
    if (!res.ok) throw new Error(`${product}/${moduleName} page ${page} returned ${res.status}`);
    const json = await res.json().catch(() => null);
    for (const row of json?.data ?? []) ids.add(normalizeZohoId(row.id));
    if (!json?.info?.more_records) break;
    if (page >= 5000) throw new Error(`${product}/${moduleName} passed 5000 pages`);
  }
  return ids;
}

function mappedIds(entity) {
  const out = execFileSync(
    'psql',
    [DB_URL, '-tAqc', `select zoho_id from zoho_id_map where entity_type = '${entity}'`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  return new Set(out.split('\n').filter(Boolean).map(normalizeZohoId));
}

console.log(`Zoho reconcile, data centre .${DC}, read-only\n`);

const counts = new Map();
let estimate = 0;
for (const entity of wanted) {
  for (const [product, moduleName] of ENTITIES[entity]) {
    const key = `${product}/${moduleName}`;
    if (!counts.has(key)) counts.set(key, await moduleCount(product, moduleName));
    estimate += Math.ceil(counts.get(key) / 200);
  }
}
if (estimate > BUDGET) {
  console.error(`Estimated ${estimate} list calls for ${wanted.join(', ')}, over --budget ${BUDGET}. Nothing was listed.`);
  process.exit(1);
}
console.log(`Estimated ${estimate} list calls.\n`);

let missingTotal = 0;
let deletedTotal = 0;
console.log('entity            in zoho   in FOOS   missing   deleted upstream');
console.log('-'.repeat(68));
const detail = [];
for (const entity of wanted) {
  const zohoSet = new Set();
  for (const [product, moduleName] of ENTITIES[entity]) {
    for (const id of await zohoIds(product, moduleName)) zohoSet.add(id);
  }
  const held = mappedIds(entity);
  const missing = [...zohoSet].filter((id) => !held.has(id));
  const deleted = [...held].filter((id) => !zohoSet.has(id));
  missingTotal += missing.length;
  deletedTotal += deleted.length;
  console.log(
    `${entity.padEnd(16)}${String(zohoSet.size).padStart(9)}${String(held.size).padStart(10)}` +
      `${String(missing.length).padStart(10)}${String(deleted.length).padStart(19)}`,
  );
  if (missing.length > 0) detail.push(`missing ${entity}: ${missing.slice(0, 20).join(' ')}${missing.length > 20 ? ' ...' : ''}`);
  if (deleted.length > 0) detail.push(`deleted upstream ${entity}: ${deleted.slice(0, 20).join(' ')}${deleted.length > 20 ? ' ...' : ''}`);
}

console.log(`\nList calls made: ${calls}`);
if (detail.length > 0) console.log(`\n${detail.join('\n')}`);
if (missingTotal > 0) {
  console.error(`\n${missingTotal} record(s) in Zoho are not in FOOS. Pull and import them with --since auto and --create-only.`);
  process.exit(1);
}
console.log(
  deletedTotal > 0
    ? `\nNothing is missing. ${deletedTotal} mapped record(s) no longer exist in Zoho and stay in FOOS by design.`
    : '\nNothing is missing and nothing was deleted upstream.',
);
