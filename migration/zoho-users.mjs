import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from './src/csv.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const EXPORT_DIR = valueOf('--dir', 'migration/zoho-exports');
const BULK_DIR = join(EXPORT_DIR, 'bulk');
const OUT_FILE = join(EXPORT_DIR, 'zoho-users.json');

const DC = process.env.ZOHO_DC ?? 'com';
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const orgId = (v) => (v ?? '').trim().replace(/^org/i, '') || undefined;
const ORG_IDS = {
  ZohoRecruit: orgId(process.env.ZOHO_RECRUIT_ORG_ID),
  ZohoCRM: orgId(process.env.ZOHO_CRM_ORG_ID),
};

const ACCOUNTS = `https://accounts.zoho.${DC}`;
const ENDPOINTS = {
  ZohoRecruit: `https://recruit.zoho.${DC}/recruit/v2/users?type=AllUsers`,
  ZohoCRM: `https://www.zohoapis.${DC}/crm/v5/users?type=AllUsers`,
};
const SCOPES = {
  ZohoRecruit: 'ZohoRecruit.users.ALL,ZohoRecruit.settings.ALL,ZohoRecruit.modules.ALL',
  ZohoCRM: 'ZohoCRM.users.READ,ZohoCRM.settings.READ',
};

const USER_FIELDS = [
  'Created_By',
  'Modified_By',
  'Owner',
  'Note_Owner',
  'Candidate_Owner',
  'Application_Owner',
  'Account_Manager',
  'Assigned_Recruiter',
  'Contact_Owner',
];

function fromLocalExtracts() {
  const map = new Map();
  if (existsSync(BULK_DIR)) {
    for (const entry of readdirSync(BULK_DIR)) {
      const dir = join(BULK_DIR, entry);
      if (!statSync(dir).isDirectory()) continue;
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        for (const row of JSON.parse(readFileSync(join(dir, file), 'utf8'))) {
          for (const field of USER_FIELDS) {
            const v = row[field];
            if (v && typeof v === 'object' && v.id && v.name) map.set(String(v.id), String(v.name));
          }
        }
      }
    }
  }
  const crmUsers = join(EXPORT_DIR, 'crm', 'Users_2026_09_02.csv');
  if (existsSync(crmUsers)) {
    for (const row of parseCsvRecords(readFileSync(crmUsers, 'utf8')).records) {
      const id = String(row['Record Id'] ?? '').trim();
      const name = String(row['Full Name'] ?? '').trim();
      if (id && name) map.set(id, name);
    }
  }
  return map;
}

function referencedIds() {
  const counts = new Map();
  if (!existsSync(BULK_DIR)) return counts;
  for (const entry of readdirSync(BULK_DIR)) {
    const dir = join(BULK_DIR, entry);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.csv')) continue;
      for (const row of parseCsvRecords(readFileSync(join(dir, file), 'utf8')).records) {
        for (const field of USER_FIELDS) {
          const v = String(row[field] ?? '').trim();
          if (/^\d{10,}$/.test(v)) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }
    }
  }
  return counts;
}

async function token(product) {
  const org = ORG_IDS[product];
  if (!CLIENT_ID || !CLIENT_SECRET || !org) return null;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: SCOPES[product],
    soid: `${product}.${org}`,
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) {
    console.error(`  ${product}: no access token (${json.error ?? res.status})`);
    return null;
  }
  return json.access_token;
}

async function fetchUsers(product) {
  const access = await token(product);
  if (!access) return [];
  const res = await fetch(ENDPOINTS[product], {
    headers: { Authorization: `Zoho-oauthtoken ${access}` },
  });
  if (!res.ok) {
    console.error(`  ${product}: users request returned ${res.status}`);
    return [];
  }
  const json = await res.json().catch(() => ({}));
  return json.users ?? [];
}

const local = fromLocalExtracts();
console.log(`${local.size} id-to-name pair(s) recovered from the extracts already on disk`);

const referenced = referencedIds();
const missing = [...referenced.entries()].filter(([id]) => !local.has(id));
console.log(
  `${referenced.size} distinct user id(s) are referenced by the CSV extracts; ${missing.length} cannot be named locally`,
);

const merged = new Map(local);

if (missing.length > 0 && !has('--offline')) {
  for (const product of ['ZohoRecruit', 'ZohoCRM']) {
    const users = await fetchUsers(product);
    let added = 0;
    for (const u of users) {
      const id = String(u.id ?? '').trim();
      const name = String(u.full_name ?? u.name ?? '').trim();
      if (!id || !name) continue;
      if (!merged.has(id)) added += 1;
      merged.set(id, name);
    }
    console.log(`  ${product}: ${users.length} user(s) returned, ${added} new`);
  }
}

const stillMissing = [...referenced.entries()].filter(([id]) => !merged.has(id));

mkdirSync(EXPORT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(Object.fromEntries(merged), null, 2)}\n`);
console.log(`\nwrote ${merged.size} id-to-name pair(s) to ${OUT_FILE}`);

if (stillMissing.length > 0) {
  console.log(`\n${stillMissing.length} referenced id(s) still have no name:`);
  for (const [id, n] of stillMissing.sort((a, b) => b[1] - a[1])) {
    console.log(`  ${id.slice(0, 6)}...${id.slice(-4)}  ${n} reference(s)`);
  }
  console.log('Those rows will import with no owner rather than a wrong one.');
  process.exit(1);
}
console.log('Every user id referenced by the extracts can be named.');
