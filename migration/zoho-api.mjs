import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseCsvRecords } from './src/csv.mjs';
import { apiRecordToExportRow, toCsv } from './src/to-csv.mjs';
import { buildFieldMap, unmatchedColumns } from './src/api-field-names.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const DC = process.env.ZOHO_DC ?? 'com';
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const orgId = (value) => (value ?? '').trim().replace(/^org/i, '') || undefined;
const RECRUIT_ORG_ID = orgId(process.env.ZOHO_RECRUIT_ORG_ID);
const CRM_ORG_ID = orgId(process.env.ZOHO_CRM_ORG_ID);
const OUT_DIR = valueOf('--out', 'migration/zoho-exports');
const ONLY = valueOf('--module', null);
const WITH_FILES = has('--with-files');
const LIMIT = Number(valueOf('--limit', '0')) || 0;

const ACCOUNTS = `https://accounts.zoho.${DC}`;
const RECRUIT = `https://recruit.zoho.${DC}/recruit/v2`;
const CRM = `https://www.zohoapis.${DC}/crm/v5`;

const SCOPES = {
  ZohoRecruit: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
  ZohoCRM: 'ZohoCRM.modules.ALL,ZohoCRM.settings.READ,ZohoCRM.users.READ',
};

const ORG_IDS = { ZohoRecruit: RECRUIT_ORG_ID, ZohoCRM: CRM_ORG_ID };

const DIRECT_TOKEN = (process.env.ZOHO_ACCESS_TOKEN ?? '').trim() || null;

const MODE = DIRECT_TOKEN
  ? 'access_token'
  : REFRESH_TOKEN
    ? 'refresh_token'
    : RECRUIT_ORG_ID || CRM_ORG_ID
      ? 'client_credentials'
      : null;

if (MODE !== 'access_token' && (!CLIENT_ID || !CLIENT_SECRET || !MODE)) {
  console.error(`Missing credentials. Set the client, then one of the two flows:

  export ZOHO_DC=com                # or eu, in, com.au, jp, ca
  export ZOHO_CLIENT_ID=...
  export ZOHO_CLIENT_SECRET=...

Client credentials, the simpler flow. No grant code and no OTP; the org id is in the
address bar when you are logged in, as recruit.zoho.com/recruit/org<ORGID>/...

  export ZOHO_RECRUIT_ORG_ID=...
  export ZOHO_CRM_ORG_ID=...

Or the authorization-code flow, if a Self Client grant code was exchanged already:

  export ZOHO_REFRESH_TOKEN=...

Or a single access token you already minted, which lasts one hour and cannot renew:

  export ZOHO_ACCESS_TOKEN=...

See migration/ZOHO-API-SETUP.md. Nothing is written without credentials, and none of
them should ever be committed.`);
  process.exit(1);
}

function serviceFor(url) {
  return url.includes('/recruit/') ? 'ZohoRecruit' : 'ZohoCRM';
}

const tokens = new Map();

async function token(service) {
  if (MODE === 'access_token') return DIRECT_TOKEN;
  const cached = tokens.get(service);
  if (cached && Date.now() < cached.expiry - 60_000) return cached.value;

  const body = new URLSearchParams(
    MODE === 'refresh_token'
      ? {
          refresh_token: REFRESH_TOKEN,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'refresh_token',
        }
      : {
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: 'client_credentials',
          scope: SCOPES[service],
          soid: `${service}.${ORG_IDS[service]}`,
        },
  );

  if (MODE === 'client_credentials' && !ORG_IDS[service]) {
    throw new Error(
      `${service} needs its org id. Set ZOHO_${service === 'ZohoRecruit' ? 'RECRUIT' : 'CRM'}_ORG_ID, ` +
        'or pass --module to stay inside the product you do have an id for.',
    );
  }

  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(
      `${MODE} token request failed for ${service} (${res.status}): ${JSON.stringify(json)}\n` +
        'INVALID_CLIENT usually means ZOHO_DC does not match the data centre the client was\n' +
        'created in. invalid_soid means the org id belongs to a different product or portal.',
    );
  }
  tokens.set(service, {
    value: json.access_token,
    expiry: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

async function call(url) {
  spend(1, url.replace(/\?.*$/, '').replace(/^https:\/\/[^/]+/, ''));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${await token(serviceFor(url))}` },
    });
    if (res.status === 204) return { data: [], info: { more_records: false } };
    if (res.status === 429 || res.status >= 500) {

      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 2000 * (attempt + 1);
      console.warn(`  ${res.status} from Zoho, retrying in ${Math.round(wait / 1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${res.status} on ${url}: ${JSON.stringify(json)}`);
    return json;
  }
  throw new Error(`gave up after retries on ${url}`);
}

async function fetchModule(base, moduleName) {
  const rows = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const json = await call(`${base}/${moduleName}?page=${page}&per_page=${perPage}`);
    const batch = json.data ?? [];
    rows.push(...batch);
    process.stdout.write(`\r  ${moduleName}: ${rows.length} records`);
    if (LIMIT && rows.length >= LIMIT) break;
    if (!json.info?.more_records) break;
    page += 1;
  }
  process.stdout.write('\n');
  return LIMIT ? rows.slice(0, LIMIT) : rows;
}

async function fetchWithSubforms(base, moduleName, ids) {
  const out = [];
  for (const [i, id] of ids.entries()) {
    const json = await call(`${base}/${moduleName}/${id}`);
    const rec = json.data?.[0];
    if (rec) out.push(rec);
    if ((i + 1) % 25 === 0) process.stdout.write(`\r  ${moduleName} detail: ${i + 1}/${ids.length}`);
  }
  process.stdout.write(`\r  ${moduleName} detail: ${ids.length}/${ids.length}\n`);
  return out;
}

async function fetchAttachmentsFor(base, moduleName, ids) {
  const out = [];
  for (const [i, id] of ids.entries()) {
    const json = await call(`${base}/${moduleName}/${id}/Attachments`);
    for (const a of json.data ?? []) out.push({ ...a, __parentId: id });
    if ((i + 1) % 25 === 0) process.stdout.write(`\r  attachments: ${i + 1}/${ids.length}`);
  }
  process.stdout.write(`\r  attachments: ${ids.length}/${ids.length}\n`);
  return out;
}

async function downloadAttachment(base, moduleName, parentId, attachmentId, destDir, fileName) {
  const res = await fetch(`${base}/${moduleName}/${parentId}/Attachments/${attachmentId}`, {
    headers: { Authorization: `Zoho-oauthtoken ${await token()}` },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(destDir, { recursive: true });
  const safe = fileName.replace(/[/\\]/g, '_');
  writeFileSync(join(destDir, safe), buf);
  return { ok: true, bytes: buf.length };
}

function save(name, rows) {
  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, 'api-raw', `${name}.json`);
  mkdirSync(join(OUT_DIR, 'api-raw'), { recursive: true });
  writeFileSync(path, JSON.stringify(rows, null, 2));
  console.log(`  wrote ${rows.length} record(s) to ${path}`);
}

function saveAsExportCsv(exportFileName, records) {
  const template = join(OUT_DIR, exportFileName);
  if (!existsSync(template)) {
    console.warn(
      `  cannot write ${exportFileName}: no existing export to take the header from.\n` +
        '    Put one hand-made export in place once so the column order is known, or pass --headers-from.',
    );
    return null;
  }
  const { header } = parseCsvRecords(readFileSync(template, 'utf8'));
  const fieldMap = buildFieldMap(header);
  const rows = records.map((r) => apiRecordToExportRow(r, fieldMap));

  const missing = unmatchedColumns(header, records);
  const out = join(OUT_DIR, 'api-csv', exportFileName);
  mkdirSync(join(OUT_DIR, 'api-csv'), { recursive: true });
  writeFileSync(out, toCsv(header, rows));
  console.log(`  wrote ${rows.length} row(s) to ${out}`);
  if (!records.length) {
    console.log(
      `    no ${exportFileName} records came back, so no column mapping was checked. ` +
        'That is a fact about this sample, not a mapping fault.',
    );
  } else if (missing.length) {
    console.warn(
      `    ${missing.length} of ${header.length} column(s) matched no API field and are blank.\n` +
        '    These are name guesses that need correcting in src/api-field-names.mjs:\n' +
        missing.map((c) => `      ${c}`).join('\n'),
    );
  }
  return { rows: rows.length, missing: missing.length };
}

const RECRUIT_MODULES = ['Candidates', 'Job_Openings', 'Applications', 'Clients', 'Contacts', 'Notes'];
const CRM_MODULES = ['Accounts', 'Contacts', 'Leads', 'Deals', 'Meetings', 'Users'];

const budgetArg = valueOf('--budget', null);
const parsedBudget = budgetArg === null ? 1500 : Number(budgetArg);
if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
  console.error(`--budget must be a number of credits, got ${budgetArg}`);
  process.exit(1);
}
const CREDIT_BUDGET = parsedBudget;
let creditsUsed = 0;

class BudgetExhausted extends Error {}

function spend(n, what) {
  creditsUsed += n;
  if (creditsUsed > CREDIT_BUDGET) {
    throw new BudgetExhausted(
      `Credit budget exhausted: ${creditsUsed} of ${CREDIT_BUDGET} after ${what}.\n` +
        'Zoho meters API credits per day and the org limit is a few thousand, so an\n' +
        'unbounded pull is not survivable. Narrow the run with --limit or --module, or\n' +
        'raise the ceiling deliberately with --budget N once you know the cost.',
    );
  }
}

async function main() {
  const summary = {};
  const want = (m) => !ONLY || ONLY.split(',').includes(m);

  console.log(`Zoho API pull, data centre .${DC}`);
  console.log(`Credit budget ${CREDIT_BUDGET}. Every request counts against it.`);

  if (!LIMIT) {
    console.log(`
No --limit given, so this run is unbounded. That is measured, not hypothetical: the
Recruit org held over 70,200 candidates on 2026-09-03, and one detail call plus one
attachment call per candidate is about 140,000 credits, roughly 23 days of a 6,250
daily allowance. The budget above will stop the run long before that.

Pass --limit N for a sample, or --budget N to raise the ceiling on purpose.
`);
  }

  for (const m of RECRUIT_MODULES) {
    if (!want(m)) continue;
    try {
      const rows = await fetchModule(RECRUIT, m);
      save(`recruit_${m}`, rows);
      summary[`recruit_${m}`] = rows.length;
      if (m === 'Notes') saveAsExportCsv('Notes_001.csv', rows);

      if (m === 'Candidates' && rows.length) {
        const ids = rows.map((r) => r.id).filter(Boolean);

        const detail = await fetchWithSubforms(RECRUIT, m, ids);
        save('recruit_Candidates_detail', detail);
        summary.recruit_Candidates_detail = detail.length;

        saveAsExportCsv('Candidates_001.csv', detail);
        const withEdu = detail.filter((r) => Array.isArray(r.Educational_Details) && r.Educational_Details.length).length;
        const withExp = detail.filter((r) => Array.isArray(r.Experience_Details) && r.Experience_Details.length).length;
        console.log(`  subforms present: ${withEdu} with education, ${withExp} with experience`);
        summary.subforms = { education: withEdu, experience: withExp };

        const atts = await fetchAttachmentsFor(RECRUIT, m, ids);
        save('recruit_Candidate_Attachments', atts);
        summary.recruit_Candidate_Attachments = atts.length;
        saveAsExportCsv('Attachments_001.csv', atts.map((a) => ({ ...a, Parent_Id: a.__parentId })));

        if (WITH_FILES) {
          let ok = 0;
          let failed = 0;
          for (const a of atts) {
            const r = await downloadAttachment(
              RECRUIT,
              m,
              a.__parentId,
              a.id,
              join(OUT_DIR, 'files', a.__parentId),
              a.File_Name ?? `${a.id}`,
            );
            if (r.ok) ok += 1;
            else failed += 1;
          }
          console.log(`  attachment files: ${ok} downloaded, ${failed} failed`);
          summary.attachment_files = { ok, failed };
        }
      }
    } catch (e) {
      if (e instanceof BudgetExhausted) throw e;
      console.error(`  ${m}: ${e.message}`);
      summary[`recruit_${m}`] = `error: ${e.message}`;
    }
  }

  for (const m of CRM_MODULES) {
    if (!want(m)) continue;
    try {
      const rows = await fetchModule(CRM, m === 'Users' ? 'users' : m);
      save(`crm_${m}`, m === 'Users' ? (rows.users ?? rows) : rows);
      summary[`crm_${m}`] = Array.isArray(rows) ? rows.length : 'see file';
    } catch (e) {
      if (e instanceof BudgetExhausted) throw e;
      console.error(`  ${m}: ${e.message}`);
      summary[`crm_${m}`] = `error: ${e.message}`;
    }
  }

  console.log(`\nAPI credits spent this run: ${creditsUsed} of the ${CREDIT_BUDGET} budget.`);
  console.log('\nSummary:');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`  ${k.padEnd(34)} ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  }
  console.log(`\nJSON written to ${OUT_DIR}. Nothing was sent anywhere.`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
