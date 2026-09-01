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
const OUT_DIR = valueOf('--out', 'migration/zoho-exports');
const ONLY = valueOf('--module', null);
const WITH_FILES = has('--with-files');
const LIMIT = Number(valueOf('--limit', '0')) || 0;

const ACCOUNTS = `https://accounts.zoho.${DC}`;
const RECRUIT = `https://recruit.zoho.${DC}/recruit/v2`;
const CRM = `https://www.zohoapis.${DC}/crm/v5`;

if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
  console.error(`Missing credentials. Set these, then re-run:

  export ZOHO_DC=com                # or eu, in, com.au, jp, ca
  export ZOHO_CLIENT_ID=...
  export ZOHO_CLIENT_SECRET=...
  export ZOHO_REFRESH_TOKEN=...

See migration/ZOHO-API-SETUP.md for how to obtain them. Nothing is written without
them, and none of them should ever be committed.`);
  process.exit(1);
}

let accessToken = null;
let accessTokenExpiry = 0;

async function token() {
  if (accessToken && Date.now() < accessTokenExpiry - 60_000) return accessToken;
  const body = new URLSearchParams({
    refresh_token: REFRESH_TOKEN,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    throw new Error(
      `token refresh failed (${res.status}): ${JSON.stringify(json)}\n` +
        'A 401 with INVALID_CLIENT usually means ZOHO_DC does not match the data centre\n' +
        'the OAuth client was created in.',
    );
  }
  accessToken = json.access_token;
  accessTokenExpiry = Date.now() + Number(json.expires_in ?? 3600) * 1000;
  return accessToken;
}

async function call(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: { Authorization: `Zoho-oauthtoken ${await token()}` },
    });
    if (res.status === 204) return { data: [], info: { more_records: false } };
    if (res.status === 429 || res.status >= 500) {
      // Zoho rate-limits per minute and per day. Back off rather than hammering.
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

// The subforms the CSV export could not produce. Zoho returns them inline on the
// record detail, which is the whole reason the API beats the export here.
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

// The importer reads the export CSV shape. Writing that shape here means the API
// path and the hand-export path feed one importer rather than two, which is the
// whole point: the API is only a faster way to get the same files.
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
  if (missing.length) {
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

async function main() {
  const summary = {};
  const want = (m) => !ONLY || ONLY.split(',').includes(m);

  console.log(`Zoho API pull, data centre .${DC}`);

  for (const m of RECRUIT_MODULES) {
    if (!want(m)) continue;
    try {
      const rows = await fetchModule(RECRUIT, m);
      save(`recruit_${m}`, rows);
      summary[`recruit_${m}`] = rows.length;
      if (m === 'Notes') saveAsExportCsv('Notes_001.csv', rows);

      if (m === 'Candidates' && rows.length) {
        const ids = rows.map((r) => r.id).filter(Boolean);
        // Education and Experience are subforms; the list endpoint omits them.
        const detail = await fetchWithSubforms(RECRUIT, m, ids);
        save('recruit_Candidates_detail', detail);
        summary.recruit_Candidates_detail = detail.length;
        // The detail records carry the Education and Experience subforms, which is
        // the reason to fetch per record at all.
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
      console.error(`  ${m}: ${e.message}`);
      summary[`crm_${m}`] = `error: ${e.message}`;
    }
  }

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
