import { supabase, assertTarget } from './local-stack.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parseCsvRecords } from '../migration/src/csv.mjs';
import { BULK_ALIASES, buildBulkColumnMap, bulkRowToExportRow } from '../migration/src/bulk-to-export.mjs';
import { mapCandidate } from '../migration/src/map-candidates.mjs';
import { mapRequisition } from '../migration/src/map-requisitions.mjs';
import { mapApplication } from '../migration/src/map-applications.mjs';
import { mapClient } from '../migration/src/map-clients.mjs';
import { mapRecruitContact } from '../migration/src/map-recruit-contacts.mjs';
import { mapNote } from '../migration/src/map-notes.mjs';
import { mapTodo } from '../migration/src/map-todos.mjs';
import { mapReview } from '../migration/src/map-reviews.mjs';
import { mapCalendlyInvite } from '../migration/src/map-calendly-invites.mjs';
import { mapCompany } from '../migration/src/map-companies.mjs';
import { mapContact } from '../migration/src/map-contacts.mjs';
import { mapLead } from '../migration/src/map-leads.mjs';
import { mapCrmNote } from '../migration/src/map-crm-notes.mjs';
import { mapCrmTask } from '../migration/src/map-crm-tasks.mjs';
import { mapCrmEvent } from '../migration/src/map-crm-events.mjs';
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
const CRM_ORG = orgId(process.env.ZOHO_CRM_ORG_ID);

const ACCOUNTS = `https://accounts.zoho.${DC}`;

const PRODUCTS = {
  recruit: {
    soid: () => `ZohoRecruit.${RECRUIT_ORG}`,
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    base: `https://recruit.zoho.${DC}/recruit/v2`,
    prefix: 'ZohoRecruit',
    org: () => RECRUIT_ORG,
  },
  crm: {
    soid: () => `ZohoCRM.${CRM_ORG}`,
    scope: 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ',
    base: `https://www.zohoapis.${DC}/crm/v7`,
    prefix: 'ZohoCRM',
    org: () => CRM_ORG,
  },
};

if (!CLIENT_ID || !CLIENT_SECRET || !RECRUIT_ORG || !CRM_ORG) {
  console.error(
    'Needs ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_RECRUIT_ORG_ID and ZOHO_CRM_ORG_ID.\n' +
      'This is the one check that reads Zoho rather than the extracted files, so it\n' +
      'cannot run offline. Every other pass is in scripts/verify-zoho-migration.mjs.',
  );
  process.exit(1);
}

const parentCache = new Map();

function resolveParent(entity, zohoId) {
  const key = `${entity}:${normalizeZohoId(zohoId)}`;
  if (parentCache.has(key)) return parentCache.get(key);
  const row = psql(
    `select foos_id from zoho_id_map where entity_type = '${entity}'
       and zoho_id = '${normalizeZohoId(zohoId)}' limit 1;`,
  );
  const id = row ? row.split('\n')[0].trim() || null : null;
  parentCache.set(key, id);
  return id;
}

const MODULES = {
  candidates: {
    product: 'recruit', idPrefix: '837085',
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
      'created_at',
    ],
  },
  requisitions: {
    product: 'recruit', idPrefix: '837085',
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
      'created_at',
    ],
  },
  applications: {
    product: 'recruit', idPrefix: '837085', entity: 'application', module: 'Applications',
    aliasKey: 'ZohoRecruit/Applications', uiHeader: null, table: 'applications',
    map: (row, l, u) =>
      mapApplication(row, l, u, {
        person: (z) => resolveParent('candidate', z),
        requisition: (z) => resolveParent('requisition', z),
      })?.application ?? {},
    compare: ['stage', 'applied_at', 'next_step', 'is_shortlisted', 'source_status'],
  },
  clients: {
    product: 'recruit', idPrefix: '837085', entity: 'company', module: 'Clients',
    aliasKey: 'ZohoRecruit/Clients', uiHeader: null, table: 'companies',
    map: (row, l, u) => mapClient(row, l, u)?.company ?? {},
    compare: ['name', 'website', 'city', 'country', 'phone'],
  },
  recruitContacts: {
    product: 'recruit', idPrefix: '837085', entity: 'contact', module: 'Contacts',
    aliasKey: 'ZohoRecruit/Contacts', uiHeader: null, table: 'people',
    map: (row, l, u) => mapRecruitContact(row, l, u, new Map())?.person ?? {},
    compare: ['first_name', 'last_name', 'city', 'country'],
  },
  notes: {
    raw: (row, l, u) => mapNote(row, l, u, resolveParent),
    product: 'recruit', idPrefix: '837085', entity: 'note', module: 'Notes',
    aliasKey: 'ZohoRecruit/Notes', uiHeader: null, table: 'activities',
    map: (row, l, u) => mapNote(row, l, u, resolveParent)?.activity ?? {},
    compare: ['kind', 'subject', 'body', 'occurred_at'],
  },
  todos: {
    product: 'recruit', idPrefix: '837085', entity: 'todo', module: 'To_Dos',
    aliasKey: 'ZohoRecruit/To_Dos', uiHeader: null,
    map: (row, l, u) => {
      const m = mapTodo(row, l, u, resolveParent);
      return m?.task ?? m?.activity ?? {};
    },
    table: (payload) => ('due_date' in payload || 'assignee_id' in payload ? 'tasks' : 'activities'),
    compare: (payload) =>
      'due_date' in payload || 'assignee_id' in payload
        ? ['subject', 'due_date', 'priority', 'status', 'related_type']
        : ['kind', 'subject', 'occurred_at', 'ends_at', 'location'],
  },
  reviews: {
    product: 'recruit', idPrefix: '837085', entity: 'review', module: 'Reviews',
    aliasKey: 'ZohoRecruit/Reviews', uiHeader: null, table: 'activities',
    map: (row, l, u) => mapReview(row, l, u, resolveParent)?.activity ?? {},
    compare: ['kind', 'subject', 'body', 'occurred_at', 'person_id'],
  },
  calendlyInvites: {
    product: 'recruit', idPrefix: '837085', entity: 'calendlyInvite', module: 'Calendly_Invites',
    aliasKey: 'ZohoRecruit/Calendly_Invites', uiHeader: null, table: 'activities',
    map: (row, l, u) => mapCalendlyInvite(row, l, u, resolveParent)?.activity ?? {},
    compare: ['kind', 'subject', 'occurred_at', 'person_id', 'requisition_id'],
  },
  crmAccounts: {
    raw: (row, l, u) => mapCompany(row, l, u),
    product: 'crm', idPrefix: '7079769', entity: 'company', module: 'Accounts',
    aliasKey: 'ZohoCRM/Accounts', uiHeader: null, table: 'companies',
    map: (row, l, u) => mapCompany(row, l, u)?.company ?? {},
    compare: ['name', 'website', 'city', 'country', 'industry', 'account_number'],
  },
  crmContacts: {
    raw: (row, l, u) => mapContact(row, l, u, new Map()),
    product: 'crm', idPrefix: '7079769', entity: 'contact', module: 'Contacts',
    aliasKey: 'ZohoCRM/Contacts', uiHeader: null, table: 'people',
    map: (row, l, u) => mapContact(row, l, u, new Map())?.person ?? {},
    compare: ['first_name', 'last_name', 'city', 'country'],
  },
  crmLeads: {
    product: 'crm', idPrefix: '7079769', entity: 'lead', module: 'Leads',
    aliasKey: 'ZohoCRM/Leads', uiHeader: null, table: 'people',
    map: (row, l, u) => mapLead(row, l, u)?.person ?? {},
    compare: ['first_name', 'last_name', 'city', 'country'],
  },
  crmNotes: {
    raw: (row, l, u) => mapCrmNote(row, l, u, resolveParent),
    product: 'crm', idPrefix: '7079769', entity: 'note', module: 'Notes',
    aliasKey: 'ZohoCRM/Notes', uiHeader: null, table: 'activities',
    map: (row, l, u) => mapCrmNote(row, l, u, resolveParent)?.activity ?? {},
    compare: ['kind', 'subject', 'body', 'occurred_at'],
  },
  crmTasks: {
    product: 'crm', idPrefix: '7079769', entity: 'crmTask', module: 'Tasks',
    aliasKey: 'ZohoCRM/Tasks', uiHeader: null, table: 'tasks',
    map: (row, l, u) => mapCrmTask(row, l, u, resolveParent)?.task ?? {},
    compare: ['subject', 'due_date', 'priority', 'status', 'related_type'],
  },
  crmEvents: {
    product: 'crm', idPrefix: '7079769', entity: 'crmEvent', module: 'Events',
    aliasKey: 'ZohoCRM/Events', uiHeader: null, table: 'activities',
    map: (row, l, u) => mapCrmEvent(row, l, u, resolveParent)?.activity ?? {},
    compare: ['kind', 'subject', 'occurred_at', 'ends_at', 'location'],
  },
};

const tokenCache = new Map();

async function token(product = 'recruit') {
  if (tokenCache.has(product)) return tokenCache.get(product);
  const cfg = PRODUCTS[product];
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: cfg.scope,
    soid: cfg.soid(),
  });
  const waits = [0, 20000, 60000, 120000];
  let last = null;
  for (const wait of waits) {
    if (wait) {
      console.log(`  ${product} token throttled, waiting ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
    const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
    const json = await res.json().catch(() => ({}));
    if (json.access_token) {
      tokenCache.set(product, json.access_token);
      return json.access_token;
    }
    last = json.error ?? res.status;
    if (!/Access Denied|too many/i.test(String(last) + JSON.stringify(json))) break;
  }
  throw new Error(`${product} token: ${last}`);
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const env = supabase(['status', '-o', 'env'], { encoding: 'utf8' });
  return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
}

function psql(sql) {
  return execFileSync(
    'psql',
    [
      assertTarget(process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:56322/postgres', 'db', process.argv.includes('--allow-remote')),
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

function bulkDir(spec) {
  const prefix = PRODUCTS[spec.product ?? 'recruit'].prefix;
  for (const suffix of ['_p1', '_paged']) {
    const candidate = join(EXPORT_DIR, 'bulk', `${prefix}_${spec.module}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function bulkHeaderMap(spec) {
  const dir = bulkDir(spec);
  if (!dir) return null;
  const files = readdirSync(dir);
  const csv = files.find((f) => f.endsWith('.csv'));
  if (csv) {
    const header = parseCsvRecords(readFileSync(join(dir, csv), 'utf8')).header.map((h) =>
      h.replace(/_/g, ' '),
    );
    return buildBulkColumnMap(header);
  }
  const jsonFile = files.find((f) => f.endsWith('.json'));
  if (!jsonFile) return null;
  const records = JSON.parse(readFileSync(join(dir, jsonFile), 'utf8'));
  const first = Array.isArray(records) ? records[0] : (records.data ?? [])[0];
  if (!first) return null;
  return buildBulkColumnMap(Object.keys(first).map((k) => k.replace(/_/g, ' ')));
}

function unescapeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
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
  return unescapeEntities(s);
}

const db = createClient(assertTarget(process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321', 'api', process.argv.includes('--allow-remote')), serviceKey(), {
  auth: { persistSession: false },
});
const lookups = await loadLookups(db);

console.log(`\nField-level spot check against the live Zoho API, ${SIZE} record(s) per module\n`);
console.log('This is the only pass that reads Zoho rather than the extracted files, so it is');
console.log('the only one that can catch the extract itself being wrong.\n');

let checked = 0;
let compared = 0;
let mismatched = 0;
const problems = [];
const absent = [];

for (const [name, spec] of Object.entries(MODULES)) {
  const idFilter = spec.idPrefix ? ` and zoho_id like '${spec.idPrefix}%'` : '';
  const rows = psql(
    `select zoho_id, foos_id from zoho_id_map where entity_type = '${spec.entity}'${idFilter}
     order by md5(zoho_id) limit ${SIZE};`,
  );
  const sample = rows
    ? rows.split('\n').map((l) => {
        const [zohoId, foosId] = l.split('|');
        return { zohoId, foosId };
      })
    : [];

  const columnMap = spec.uiHeader ? uiColumnMap(spec) : (bulkHeaderMap(spec) ?? buildBulkColumnMap([]));
  const declared = BULK_ALIASES[spec.aliasKey] ?? {};
  const aliases = { ...declared };
  for (const [from, to] of Object.entries(declared)) {
    const lower = from.charAt(0).toLowerCase() + from.slice(1);
    if (lower !== from && aliases[lower] === undefined) aliases[lower] = to;
  }

  let moduleMismatch = 0;
  for (const { zohoId, foosId } of sample) {
    const product = spec.product ?? 'recruit';
    const access = await token(product);
    const res = await fetch(`${PRODUCTS[product].base}/${spec.module}/${zohoId}`, {
      headers: { Authorization: `Zoho-oauthtoken ${access}` },
    });
    if (!res.ok) {
      problems.push(`${name} ${zohoId.slice(-6)}: Zoho returned ${res.status}`);
      continue;
    }
    const json = await res.json().catch(() => ({}));
    const live = json.data?.[0];
    if (!live) {
      absent.push(`${name} ${zohoId.slice(-6)}`);
      continue;
    }
    checked += 1;

    const flattened = {};
    for (const [k, v] of Object.entries(live)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          if (v2 && typeof v2 === 'object' && !Array.isArray(v2)) {
            for (const [k3, v3] of Object.entries(v2)) flattened[`${k}.${k2}.${k3}`] = v3;
          } else {
            flattened[`${k}.${k2}`] = v2;
          }
        }
      }
    }
    const FOREIGN_KEYS = new Set(['Parent_Id', 'What_Id', 'Who_Id']);
    const idOnly = {};
    for (const [k, v] of Object.entries(live)) {
      if (FOREIGN_KEYS.has(k) && v && typeof v === 'object' && typeof v.id === 'string') {
        idOnly[k] = v.id;
      }
    }
    const row = {
      ...live,
      ...idOnly,
      ...flattened,
      ...bulkRowToExportRow(live, columnMap, aliases),
    };
    const rawMapped = spec.raw ? spec.raw(row, lookups, newUnresolved()) : null;
    const mapped = spec.map(row, lookups, newUnresolved());
    const expected = mapped ?? {};
    if (Object.keys(expected).length === 0) {
      const why = rawMapped?.skip ?? 'the mapper returned no payload and no skip reason';
      problems.push(`${name} ${zohoId.slice(-6)}: mapper skipped, ${why}`);
      continue;
    }

    const table = typeof spec.table === 'function' ? spec.table(expected) : spec.table;
    const compare = typeof spec.compare === 'function' ? spec.compare(expected) : spec.compare;
    const { data: actual, error } = await db
      .from(table)
      .select(compare.join(', '))
      .eq('id', foosId)
      .maybeSingle();
    if (error || !actual) {
      problems.push(`${name} ${zohoId.slice(-6)}: no FOOS row (${error?.message ?? 'missing'})`);
      continue;
    }

    for (const field of compare) {
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
    `  ${name.padEnd(18)}${String(sample.length).padStart(4)} sampled, ${moduleMismatch} mismatch(es)`,
  );
}

console.log(`\n  ${checked} record(s) fetched from Zoho, ${compared} field comparison(s), ${mismatched} mismatch(es)`);

if (absent.length > 0) {
  console.log(`\n${absent.length} sampled record(s) no longer exist in Zoho, so nothing could be`);
  console.log('compared. A record FOOS holds that Zoho does not serve is upstream deletion or a');
  console.log('record the importer synthesised, not a migration defect:');
  for (const a of absent.slice(0, 20)) console.log(`  - ${a}`);
}

if (problems.length === 0) {
  console.log('\nEvery sampled field matches what the live Zoho record maps to.\n');
  process.exit(0);
}
console.log(`\n${problems.length} problem(s):\n`);
for (const p of problems.slice(0, 40)) console.log(`  - ${p}`);
if (problems.length > 40) console.log(`  ... and ${problems.length - 40} more`);
console.log('');
process.exit(1);
