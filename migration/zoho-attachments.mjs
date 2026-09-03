import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { parseCsvRecords } from './src/csv.mjs';
import { deterministicId, isDuplicateKey, normalizeZohoId } from './src/deterministic-id.mjs';
import { ATTACHMENT_KIND_BY_LABEL, looksLikeIdentityDocument } from './src/lookups.mjs';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const EXPORT_DIR = valueOf('--dir', 'migration/zoho-exports');
const MANIFEST = join(EXPORT_DIR, 'attachments-manifest.json');

const APPLY = has('--apply');
const ENUMERATE = has('--enumerate');
const DOWNLOAD = has('--download');
const LIMIT = Number(valueOf('--limit', '0')) || 0;
const BUDGET = args.includes('--budget') ? Number(valueOf('--budget', '0')) : 2600;
const ALLOW_REMOTE = has('--allow-remote');
const INCLUDE_IDENTITY = has('--include-identity-documents');
const RETRY_ONLY = has('--retry-failed');

const DC = process.env.ZOHO_DC ?? 'com';
const CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;
const orgId = (v) => (v ?? '').trim().replace(/^org/i, '') || undefined;
const RECRUIT_ORG = orgId(process.env.ZOHO_RECRUIT_ORG_ID);
const ACCOUNTS = `https://accounts.zoho.${DC}`;
const RECRUIT = `https://recruit.zoho.${DC}/recruit/v2`;

const BUCKET = 'attachments';
const STORAGE_PREFIX = 'zoho-import';

const PARENT_MODULES = {
  Candidates: { dir: 'ZohoRecruit_Candidates_p1', parentType: 'person', entity: 'candidate' },
  Job_Openings: { dir: 'ZohoRecruit_Job_Openings_p1', parentType: 'requisition', entity: 'requisition' },
  Applications: { dir: 'ZohoRecruit_Applications_paged', parentType: 'application', entity: 'application' },
  Clients: { dir: 'ZohoRecruit_Clients_p1', parentType: 'company', entity: 'company' },
};

const MODULE = valueOf('--module', 'Candidates');
const FAILED_IDS = join(EXPORT_DIR, `attachments-failed-${MODULE}.json`);

let spent = 0;
function spend(n, what) {
  if (spent + n > BUDGET) {
    console.error(
      `\nCredit budget reached: ${spent} spent, ${n} more needed for ${what}, ceiling ${BUDGET}.\n` +
        'The org allowance is 6,250 per day and every request costs one. Raise it deliberately\n' +
        'with --budget, having checked the console, rather than by default.',
    );
    process.exit(1);
  }
  spent += n;
}

function url() {
  return process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
}
function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const env = execSync('supabase status -o env', { encoding: 'utf8' });
    return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
  } catch {
    return null;
  }
}

const target = url();
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target) && !ALLOW_REMOTE) {
  console.error(`Refusing to write attachments to ${target}. Pass --allow-remote deliberately.`);
  process.exit(1);
}

async function token() {
  spend(1, 'an access token');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID ?? '',
    client_secret: CLIENT_SECRET ?? '',
    scope: 'ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    soid: `ZohoRecruit.${RECRUIT_ORG}`,
  });
  const res = await fetch(`${ACCOUNTS}/oauth/v2/token`, { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!json.access_token) throw new Error(`no access token: ${json.error ?? res.status}`);
  return json.access_token;
}

function recordsWithAttachments(moduleName) {
  const spec = PARENT_MODULES[moduleName];
  if (!spec) return [];
  const dir = join(EXPORT_DIR, 'bulk', spec.dir);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir);
  const csv = files.find((f) => f.endsWith('.csv'));
  let records;
  if (csv) {
    records = parseCsvRecords(readFileSync(join(dir, csv), 'utf8')).records;
  } else {
    const jsonFile = files.find((f) => f.endsWith('.json'));
    if (!jsonFile) return [];
    records = JSON.parse(readFileSync(join(dir, jsonFile), 'utf8'));
  }
  return records
    .filter((r) => String(r.Is_Attachment_Present ?? '').trim().toLowerCase() === 'true')
    .map((r) => normalizeZohoId(r.Id ?? r.id))
    .filter(Boolean);
}

async function getWithBackoff(url, access, what) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    spend(1, what);
    const res = await fetch(url, { headers: { Authorization: `Zoho-oauthtoken ${access}` } });
    if (res.ok || res.status === 204 || res.status === 404) return res;

    let throttled = res.status === 429 || res.status >= 500;
    if (!throttled && res.status === 400) {
      const body = await res.clone().text().catch(() => '');
      throttled = body.includes('URL_FIXED_THROTTLES_LIMIT_EXCEEDED');
    }
    if (!throttled) return res;
    await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
  }
  return null;
}

function categoryName(entry) {
  const c = entry.Category;
  if (c && typeof c === 'object') return String(c.name ?? '').trim();
  return String(c ?? '').trim();
}

function kindFor(entry) {
  const label = categoryName(entry) || String(entry.$attach_type ?? '').trim();
  const byLabel = ATTACHMENT_KIND_BY_LABEL.get(label);
  if (byLabel) return byLabel;
  const name = String(entry.File_Name ?? '').toLowerCase();
  if (/resume|cv\b/.test(name)) return 'resume';
  if (/cover/.test(name)) return 'cover';
  if (/contract/.test(name)) return 'contract';
  if (/offer/.test(name)) return 'offer';
  return 'other';
}

async function runEnumerate() {
  if (!CLIENT_ID || !CLIENT_SECRET || !RECRUIT_ORG) {
    console.error('Needs ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_RECRUIT_ORG_ID.');
    process.exit(1);
  }
  const spec = PARENT_MODULES[MODULE];
  if (!spec) {
    console.error(`Unknown --module ${MODULE}. One of: ${Object.keys(PARENT_MODULES).join(', ')}`);
    process.exit(1);
  }
  let ids = RETRY_ONLY && existsSync(FAILED_IDS)
    ? JSON.parse(readFileSync(FAILED_IDS, 'utf8'))
    : recordsWithAttachments(MODULE);
  if (ids.length === 0) {
    console.error('No candidates with Is_Attachment_Present=true in the extract.');
    process.exit(1);
  }
  if (LIMIT > 0) ids = ids.slice(0, LIMIT);

  console.log(`\nEnumerating ${MODULE} attachments for ${ids.length} record(s), one request each.`);
  console.log(`Budget ceiling ${BUDGET}; the daily org allowance is 6,250.\n`);

  const access = await token();
  const manifest = [];
  let empty = 0;
  let failed = 0;
  const failedIds = [];
  const reasons = {};
  const note = (why) => {
    const key = String(why).slice(0, 140);
    reasons[key] = (reasons[key] ?? 0) + 1;
  };

  for (let i = 0; i < ids.length; i += 1) {
    const candidateId = ids[i];
    const res = await getWithBackoff(
      `${RECRUIT}/${MODULE}/${candidateId}/Attachments`,
      access,
      `attachments for ${MODULE} record ${i + 1}`,
    );
    if (res === null) {
      failed += 1;
      failedIds.push(candidateId);
      note('gave up after four attempts, all 429 or 5xx');
    } else if (res.status === 204) {
      empty += 1;
    } else if (!res.ok) {
      failed += 1;
      failedIds.push(candidateId);
      note(`${res.status}: ${(await res.text().catch(() => '')).slice(0, 100)}`);
    } else {
      const json = await res.json().catch(() => ({}));
      for (const a of json.data ?? []) {
        manifest.push({
          module: MODULE,
          candidateZohoId: candidateId,
          attachmentZohoId: String(a.id),
          fileName: String(a.File_Name ?? ''),
          sizeBytes: Number(a.Size ?? 0) || null,
          createdTime: a.Created_Time ?? null,
          category: categoryName(a) || null,
          kind: kindFor(a),
          identity: looksLikeIdentityDocument(String(a.File_Name ?? '')),
        });
      }
    }
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${ids.length} candidates, ${manifest.length} attachment(s) so far`);
    }
  }

  mkdirSync(EXPORT_DIR, { recursive: true });
  if (existsSync(MANIFEST)) {
    const prior = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const seen = new Set(manifest.map((m) => m.attachmentZohoId));
    for (const m of prior) if (!seen.has(m.attachmentZohoId)) manifest.push(m);
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(FAILED_IDS, `${JSON.stringify(failedIds, null, 2)}\n`);

  const thisModule = manifest.filter((m) => (m.module ?? 'Candidates') === MODULE).length;
  const identity = manifest.filter((m) => m.identity).length;
  const bytes = manifest.reduce((n, m) => n + (m.sizeBytes ?? 0), 0);
  console.log(`\n  candidates queried      ${ids.length}`);
  console.log(`  returned no attachments ${empty}`);
  console.log(`  requests that failed    ${failed}`);
  console.log(`  attachments for ${MODULE.padEnd(13)}${thisModule}`);
  console.log(`  manifest total          ${manifest.length}`);
  console.log(`  of those, identity docs ${identity} (held back unless --include-identity-documents)`);
  console.log(`  total bytes             ${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`  credits spent           ${spent}`);
  for (const [why, n] of Object.entries(reasons)) console.log(`    x${n}  ${why}`);
  if (failedIds.length > 0) {
    console.log(`\n  ${failedIds.length} candidate id(s) written to ${FAILED_IDS}.`);
    console.log('  Retry only those with --enumerate --retry-failed, which costs that many credits');
    console.log('  rather than another full pass.');
  }
  console.log(`\n  manifest: ${MANIFEST}`);
  console.log(`  downloading them costs ${manifest.length - (INCLUDE_IDENTITY ? 0 : identity)} more credits.`);
}

async function runDownload() {
  if (!existsSync(MANIFEST)) {
    console.error(`No manifest at ${MANIFEST}. Run with --enumerate first.`);
    process.exit(1);
  }
  const key = serviceKey();
  if (!key) {
    console.error('No service-role key. Start the local stack or set SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const db = createClient(target, key, { auth: { persistSession: false } });

  let manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const heldBack = INCLUDE_IDENTITY ? 0 : manifest.filter((m) => m.identity).length;
  if (!INCLUDE_IDENTITY) manifest = manifest.filter((m) => !m.identity);
  if (LIMIT > 0) manifest = manifest.slice(0, LIMIT);

  const parentByZoho = new Map();
  for (const entity of new Set(Object.values(PARENT_MODULES).map((p) => p.entity))) {
    let after = '';
    for (;;) {
      const { data, error } = await db
        .from('zoho_id_map')
        .select('zoho_id, foos_id')
        .eq('entity_type', entity)
        .gt('zoho_id', after)
        .order('zoho_id', { ascending: true })
        .limit(1000);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      for (const r of rows) parentByZoho.set(`${entity}:${normalizeZohoId(r.zoho_id)}`, r.foos_id);
      if (rows.length < 1000) break;
      after = rows[rows.length - 1].zoho_id;
    }
  }

  console.log(`\n${manifest.length} attachment(s) to fetch, ${heldBack} identity document(s) held back.`);
  if (!APPLY) {
    console.log('Dry run. Nothing is downloaded or written. Re-run with --apply.');
    console.log(`It would cost ${manifest.length} credits against a ceiling of ${BUDGET}.`);
    return;
  }

  const access = await token();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const reasons = {};
  const note = (why) => {
    const key = String(why).slice(0, 140);
    reasons[key] = (reasons[key] ?? 0) + 1;
  };

  for (const m of manifest) {
    const entryModule = m.module ?? 'Candidates';
    const spec = PARENT_MODULES[entryModule];
    const personId = spec ? parentByZoho.get(`${spec.entity}:${m.candidateZohoId}`) : null;
    if (!personId) {
      skipped += 1;
      note(`parent not imported for ${entryModule}`);
      continue;
    }
    const path = `${STORAGE_PREFIX}/${personId}/${m.attachmentZohoId}-${m.fileName.replace(/[^\w.\-]+/g, '_')}`;

    const existing = await db.storage.from(BUCKET).list(`${STORAGE_PREFIX}/${personId}`, {
      search: `${m.attachmentZohoId}-`,
    });
    if (!existing.error && (existing.data ?? []).length > 0) {
      skipped += 1;
      continue;
    }

    const res = await getWithBackoff(
      `${RECRUIT}/${entryModule}/${m.candidateZohoId}/Attachments/${m.attachmentZohoId}`,
      access,
      `downloading ${m.attachmentZohoId}`,
    );
    if (res === null) {
      failed += 1;
      note('download gave up after four attempts');
      continue;
    }
    if (!res.ok) {
      failed += 1;
      note(`download returned ${res.status}: ${(await res.text().catch(() => '')).slice(0, 90)}`);
      continue;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());

    const rawType = res.headers.get('content-type') ?? 'application/octet-stream';
    const contentType = rawType.split(';')[0].trim() || 'application/octet-stream';
    const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: true });
    if (up.error) {
      failed += 1;
      note(`storage upload failed: ${up.error.message}`);
      continue;
    }

    const id = deterministicId('attachment', m.attachmentZohoId);
    const row = {
      id,
      storage_path: path,
      parent_type: spec.parentType,
      parent_id: personId,
      kind: m.kind,
      description: m.fileName || null,
      file_size_bytes: bytes.byteLength,
    };
    const ins = await db.from('attachments').insert(row);
    if (ins.error && !isDuplicateKey(ins.error)) {
      failed += 1;
      note(`attachments insert failed: ${ins.error.message}`);
      continue;
    }
    if (ins.error) {
      const upd = await db.from('attachments').update(row).eq('id', id);
      if (upd.error) {
        failed += 1;
        note(`attachments update failed: ${upd.error.message}`);
        continue;
      }
    }
    const map = await db
      .from('zoho_id_map')
      .upsert(
        { zoho_id: normalizeZohoId(m.attachmentZohoId), entity_type: 'attachment', foos_id: id },
        { onConflict: 'zoho_id,entity_type' },
      );
    if (map.error) {
      failed += 1;
      note(`mapping failed: ${map.error.message}`);
      continue;
    }
    uploaded += 1;
    if (uploaded % 100 === 0) console.log(`  ${uploaded} uploaded, ${spent} credits spent`);
  }

  console.log(`\n  uploaded ${uploaded}`);
  console.log(`  skipped  ${skipped} (already present, or the candidate is not imported)`);
  console.log(`  failed   ${failed}`);
  console.log(`  credits  ${spent}`);
  for (const [why, n] of Object.entries(reasons)) console.log(`    x${n}  ${why}`);
}

if (!ENUMERATE && !DOWNLOAD) {
  console.error(
    'Zoho attachments have no bulk endpoint, so this costs one request per candidate to\n' +
      'enumerate and one per file to download. Both phases are separate on purpose, so the\n' +
      'real file count is known before any bytes are fetched.\n\n' +
      '  node migration/zoho-attachments.mjs --enumerate            # 526 requests, writes a manifest\n' +
      '  node migration/zoho-attachments.mjs --download             # dry run, prints the cost\n' +
      '  node migration/zoho-attachments.mjs --download --apply     # fetches and stores\n\n' +
      'Flags: --limit N to bound either phase, --budget N to raise the credit ceiling\n' +
      '(default 2600 against a 6,250 daily allowance), --include-identity-documents to stop\n' +
      'holding back passports and licences, which are excluded by default and by request.',
  );
  process.exit(1);
}

if (ENUMERATE) await runEnumerate();
if (DOWNLOAD) await runDownload();
