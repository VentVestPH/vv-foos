import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const DC = (process.env.ZOHO_DC ?? 'com').trim();
const CLIENT_ID = (process.env.ZOHO_CLIENT_ID ?? '').trim();
const CLIENT_SECRET = (process.env.ZOHO_CLIENT_SECRET ?? '').trim();
const orgId = (v) => (v ?? '').trim().replace(/^org/i, '');
const RECRUIT_ORG = orgId(process.env.ZOHO_RECRUIT_ORG_ID);
const CRM_ORG = orgId(process.env.ZOHO_CRM_ORG_ID);

const OUT_DIR = valueOf('--out', 'migration/zoho-exports/bulk');
const ONLY = valueOf('--module', null);
const BUDGET = (() => {
  const raw = valueOf('--budget', null);
  const n = raw === null ? 3000 : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`--budget must be a number of credits, got ${raw}`);
    process.exit(1);
  }
  return n;
})();

const PAGE_CEILING = 200000;
const POLL_INTERVAL_MS = Number(valueOf('--poll-ms', '4000'));
const POLL_LIMIT = Number(valueOf('--poll-limit', '150'));
const COUNTS_ONLY = has('--counts-only');
const LOCAL_DB = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

const PRODUCTS = {
  ZohoRecruit: {
    org: RECRUIT_ORG,
    orgVar: 'ZOHO_RECRUIT_ORG_ID',
    scope: 'ZohoRecruit.bulk.read,ZohoRecruit.modules.ALL,ZohoRecruit.settings.ALL',
    bulkBase: `https://recruit.zoho.${DC}/recruit/bulk/v2/read`,
    queryBody: (moduleName, page) => ({ query: { module: moduleName, page } }),
    countUrl: (m) => `https://recruit.zoho.${DC}/recruit/v2/${m}/actions/count`,
    listUrl: (m, page, per) =>
      `https://recruit.zoho.${DC}/recruit/v2/${m}?per_page=${per}&page=${page}`,
    modules: [
      'Candidates',
      'Job_Openings',
      'Applications',
      'Clients',
      'Contacts',
      'Notes',
      'Departments',
    ],
  },
  ZohoCRM: {
    org: CRM_ORG,
    orgVar: 'ZOHO_CRM_ORG_ID',
    scope: 'ZohoCRM.bulk.READ,ZohoCRM.modules.ALL,ZohoCRM.settings.READ',
    bulkBase: `https://www.zohoapis.${DC}/crm/bulk/v7/read`,
    queryBody: (moduleName, page) => ({ query: { module: { api_name: moduleName }, page } }),
    countUrl: (m) => `https://www.zohoapis.${DC}/crm/v7/${m}/actions/count`,
    listUrl: (m, page, per) =>
      `https://www.zohoapis.${DC}/crm/v7/${m}?per_page=${per}&page=${page}`,
    modules: ['Accounts', 'Contacts', 'Leads', 'Notes'],
  },
};

let creditsUsed = 0;

function spend(n, what) {
  creditsUsed += n;
  if (creditsUsed > BUDGET) {
    throw new Error(
      `Credit budget exhausted: ${creditsUsed} of ${BUDGET} after ${what}.\n` +
        'Raise it deliberately with --budget N, or narrow the run with --module.',
    );
  }
}

const tokens = new Map();

async function token(product) {
  const cfg = PRODUCTS[product];
  const cached = tokens.get(product);
  if (cached && Date.now() < cached.expiry - 60000) return cached.value;

  spend(1, `${product} token`);
  const res = await fetch(`https://accounts.zoho.${DC}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: cfg.scope,
      soid: `${product}.${cfg.org}`,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!json?.access_token) {
    throw new Error(
      `${product} token request failed (${res.status}): ${JSON.stringify(json)}\n` +
        'invalid_soid means the org id belongs to the other product. OAUTH_SCOPE_MISMATCH on a\n' +
        'bulk call means the bulk scope was not granted; it is separate from modules.ALL.',
    );
  }
  tokens.set(product, {
    value: json.access_token,
    expiry: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  });
  return json.access_token;
}

async function call(product, url, init = {}, cost = 1) {
  spend(cost, url.replace(/^https:\/\/[^/]+/, ''));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Zoho-oauthtoken ${await token(product)}`,
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after') ?? 0) * 1000 || 2000 * (attempt + 1);
      console.log(`    ${res.status} from Zoho, waiting ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res;
  }
  throw new Error(`gave up after 5 attempts on ${url}`);
}

async function moduleCount(product, moduleName) {
  const res = await call(product, PRODUCTS[product].countUrl(moduleName));
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const n = json?.count;
  return typeof n === 'number' ? n : Number(n ?? Number.NaN);
}

const ENTITY_OF = {
  'ZohoRecruit/Candidates': 'candidate',
  'ZohoRecruit/Job_Openings': 'requisition',
  'ZohoRecruit/Applications': 'application',
  'ZohoRecruit/Clients': 'company',
  'ZohoRecruit/Contacts': 'contact',
  'ZohoRecruit/Notes': 'note',
  'ZohoRecruit/Departments': null,
  'ZohoCRM/Accounts': 'company',
  'ZohoCRM/Contacts': 'contact',
  'ZohoCRM/Leads': 'lead',
  'ZohoCRM/Notes': 'note',
};

function heldByEntity() {
  const url = valueOf('--db', process.env.FOOS_LOCAL_DB_URL ?? LOCAL_DB);
  const out = execFileSync(
    'psql',
    [url, '-tAqc', 'select entity_type, count(*) from zoho_id_map group by 1'],
    { encoding: 'utf8' },
  );
  const held = new Map();
  for (const line of out.split('\n')) {
    const [entity, n] = line.split('|');
    if (entity) held.set(entity.trim(), Number(n));
  }
  return held;
}

async function countsOnly() {
  const rows = [];
  for (const [product, cfg] of Object.entries(PRODUCTS)) {
    if (!cfg.org) {
      console.log(`${product}: skipped, ${cfg.orgVar} is not set\n`);
      continue;
    }
    console.log(`${product}`);
    for (const moduleName of cfg.modules) {
      if (ONLY && !ONLY.split(',').includes(moduleName)) continue;
      const key = `${product}/${moduleName}`;
      try {
        const zoho = await moduleCount(product, moduleName);
        rows.push({ key, entity: ENTITY_OF[key] ?? null, zoho });
        console.log(`  ${moduleName.padEnd(14)} ${String(zoho ?? '?').padStart(9)}`);
      } catch (err) {
        rows.push({ key, entity: ENTITY_OF[key] ?? null, zoho: null, error: err.message });
        console.log(`  ${moduleName.padEnd(14)} FAILED  ${err.message}`);
      }
    }
    console.log('');
  }

  const held = heldByEntity();
  const wanted = new Map();
  for (const row of rows) {
    if (!row.entity || typeof row.zoho !== 'number') continue;
    wanted.set(row.entity, (wanted.get(row.entity) ?? 0) + row.zoho);
  }

  console.log('entity        in zoho   imported     delta  modules counted');
  console.log('-'.repeat(72));
  let short = 0;
  for (const entity of [...new Set([...wanted.keys(), ...held.keys()])].sort()) {
    const inZoho = wanted.get(entity);
    const imported = held.get(entity) ?? 0;
    const delta = typeof inZoho === 'number' ? imported - inZoho : null;
    if (delta !== null && delta < 0) short += 1;
    const from = rows
      .filter((r) => r.entity === entity && typeof r.zoho === 'number')
      .map((r) => r.key)
      .join(' + ');
    console.log(
      `${entity.padEnd(12)}${String(inZoho ?? '?').padStart(9)}${String(imported).padStart(11)}` +
        `${(delta === null ? '?' : delta > 0 ? `+${delta}` : String(delta)).padStart(10)}  ${from || '(none)'}`,
    );
  }
  const counted = rows.filter((r) => typeof r.zoho === 'number').length;
  const failed = rows.filter((r) => r.error).length;
  console.log(`\n${counted} of ${rows.length} module(s) counted, credits used ${creditsUsed}`);

  if (counted === 0) {
    console.error(
      '\nNothing was counted, so this proves nothing. Needs ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET\n' +
        'and the org id for each product you want checked: ZOHO_RECRUIT_ORG_ID, ZOHO_CRM_ORG_ID.',
    );
    process.exit(1);
  }
  if (failed > 0) {
    console.error(`\n${failed} module(s) failed to report a count; the totals above are partial.`);
    process.exit(1);
  }
  if (short > 0) {
    console.error(`\n${short} entit${short === 1 ? 'y is' : 'ies are'} short of what Zoho reports.`);
    process.exit(1);
  }
  console.log('\nEvery counted entity holds at least what Zoho reports.');
}

if (COUNTS_ONLY) {
  await countsOnly();
  process.exit(0);
}

const LIST_PER_PAGE = 200;

async function pagedFallback(product, moduleName, destDir) {
  mkdirSync(destDir, { recursive: true });
  const rows = [];
  for (let page = 1; ; page += 1) {
    const res = await call(product, PRODUCTS[product].listUrl(moduleName, page, LIST_PER_PAGE));
    if (res.status === 204) break;
    if (!res.ok) throw new Error(`paged read of ${moduleName} page ${page} returned ${res.status}`);
    const json = await res.json().catch(() => null);
    const batch = json?.data ?? [];
    rows.push(...batch);
    if (page % 25 === 0 || batch.length === 0) {
      process.stdout.write(`\n    paged ${moduleName}: ${rows.length} rows after ${page} calls`);
    }
    if (!json?.info?.more_records) break;
    if (page >= 5000) {
      throw new Error(
        `paged read of ${moduleName} passed 5000 pages without more_records going false; ` +
          'refusing to loop further',
      );
    }
  }
  const dest = join(destDir, `${moduleName}.json`);
  writeFileSync(dest, JSON.stringify(rows, null, 2));
  return { file: dest, rows: rows.length };
}

async function initiateJob(product, moduleName, page) {
  let res;
  try {
    res = await call(
      product,
      PRODUCTS[product].bulkBase,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(PRODUCTS[product].queryBody(moduleName, page)),
      },
      50,
    );
  } catch (e) {
    if (/gave up after/.test(e.message)) {
      return { unsupported: 'persistent 5xx from the bulk endpoint' };
    }
    throw e;
  }
  const json = await res.json().catch(() => null);
  const item = json?.data?.[0];
  const refusal = [json?.code, item?.code].find((c) =>
    ['NO_PERMISSION', 'INVALID_MODULE', 'NOT_SUPPORTED', 'MODULE_NOT_AVAILABLE'].includes(c),
  );
  if (refusal) return { unsupported: refusal };
  if (!item?.details?.id) {
    throw new Error(`${product}/${moduleName} page ${page}: ${JSON.stringify(json)}`);
  }
  return { id: item.details.id };
}

async function awaitJob(product, jobId) {
  for (let i = 0; i < POLL_LIMIT; i += 1) {
    const res = await call(product, `${PRODUCTS[product].bulkBase}/${jobId}`);
    const json = await res.json().catch(() => null);
    const item = json?.data?.[0];
    const state = item?.state;
    if (state === 'COMPLETED') return item.result ?? {};
    if (state === 'FAILURE' || state === 'FAILED') {
      throw new Error(`job ${jobId} failed: ${JSON.stringify(item)}`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`job ${jobId} did not complete within ${POLL_LIMIT} polls`);
}

async function downloadResult(product, jobId, destZip) {
  const res = await call(product, `${PRODUCTS[product].bulkBase}/${jobId}/result`);
  if (res.status === 403) {
    const body = await res.text().catch(() => '');
    const needed = /"permissions":\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '';
    return { refused: true, permissions: needed.replace(/"/g, '') };
  }
  if (!res.ok) throw new Error(`download for ${jobId} returned ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destZip, buf);
  return { bytes: buf.length };
}

function unzipTo(zipPath, dir) {
  mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', dir], { stdio: 'ignore' });
}

function csvDataRows(dir, jobId) {
  const file = join(dir, `${jobId}.csv`);
  if (!existsSync(file)) return { file: null, rows: 0 };
  const text = readFileSync(file, 'utf8');
  let rows = -1;
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && c === '\n') rows += 1;
  }
  if (text.length > 0 && !text.endsWith('\n')) rows += 1;
  return { file, rows: Math.max(0, rows) };
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    'Set the Self Client values and both org ids:\n\n' +
      '  export ZOHO_DC=com\n' +
      "  export ZOHO_CLIENT_ID='1000.XXXX'\n" +
      "  export ZOHO_CLIENT_SECRET='xxxx'\n" +
      '  export ZOHO_RECRUIT_ORG_ID=904926665\n' +
      '  export ZOHO_CRM_ORG_ID=904923852\n\n' +
      '  node migration/zoho-bulk-read.mjs --module Contacts     # one module\n' +
      '  node migration/zoho-bulk-read.mjs                       # everything',
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const summary = [];
const started = Date.now();

console.log(`Zoho bulk read, data centre .${DC}, credit budget ${BUDGET}`);
console.log(`Output: ${OUT_DIR}\n`);

for (const [product, cfg] of Object.entries(PRODUCTS)) {
  if (!cfg.org) {
    console.log(`${product}: skipped, ${cfg.orgVar} is not set`);
    continue;
  }
  for (const moduleName of cfg.modules) {
    if (ONLY && !ONLY.split(',').includes(moduleName)) continue;

    try {
      const expected = await moduleCount(product, moduleName);
      if (expected === 0) {
        console.log(`${product}/${moduleName}: 0 records, skipped`);
        summary.push({ product, module: moduleName, expected: 0, downloaded: 0, pages: 0 });
        continue;
      }

      const pages = expected === null ? 1 : Math.max(1, Math.ceil(expected / PAGE_CEILING));
      let downloaded = 0;
      const files = [];

      for (let page = 1; page <= pages; page += 1) {
        const label = pages > 1 ? `${moduleName} page ${page}/${pages}` : moduleName;
        process.stdout.write(`${product}/${label}: initiating`);
        const started = await initiateJob(product, moduleName, page);
        if (started.unsupported) {
          process.stdout.write(
            `, bulk read refused it (${started.unsupported}), falling back to the paged API`,
          );
          const dir = join(OUT_DIR, `${product}_${moduleName}_paged`);
          const { rows } = await pagedFallback(product, moduleName, dir);
          downloaded += rows;
          files.push(dir);
          process.stdout.write(`, ${rows} rows\n`);
          break;
        }
        const jobId = started.id;
        process.stdout.write(`, job ${jobId}, polling`);
        const result = await awaitJob(product, jobId);
        const zipPath = join(OUT_DIR, `${product}_${moduleName}_p${page}.zip`);
        const got = await downloadResult(product, jobId, zipPath);
        if (got.refused) {
          process.stdout.write(
            `, the job completed but its result is refused (${got.permissions}),` +
              ' falling back to the paged API',
          );
          const dir = join(OUT_DIR, `${product}_${moduleName}_paged`);
          const { rows } = await pagedFallback(product, moduleName, dir);
          downloaded = rows;
          files.push(dir);
          process.stdout.write(`, ${rows} rows\n`);
          break;
        }
        const bytes = got.bytes;
        const dir = join(OUT_DIR, `${product}_${moduleName}_p${page}`);
        unzipTo(zipPath, dir);
        const { file, rows } = csvDataRows(dir, jobId);
        downloaded += rows;
        files.push(file);
        process.stdout.write(
          `, ${rows} rows, ${(bytes / 1024).toFixed(0)} KB` +
            (result.more_records ? ', more_records=true' : '') +
            '\n',
        );
      }

      const reconciled = expected === null || downloaded === expected;
      summary.push({ product, module: moduleName, expected, downloaded, pages, reconciled, files });
      if (!reconciled) {
        console.log(
          `  MISMATCH ${product}/${moduleName}: count says ${expected}, downloaded ${downloaded}`,
        );
      }
    } catch (e) {
      console.log(`${product}/${moduleName}: FAILED, ${e.message.split('\n')[0]}`);
      summary.push({ product, module: moduleName, error: e.message });
      if (/budget exhausted/i.test(e.message)) break;
    }
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\nCredits spent: ${creditsUsed} of the ${BUDGET} budget, in ${seconds}s\n`);
console.log('module                        expected  downloaded  reconciled');
for (const s of summary) {
  if (s.error) {
    console.log(`${`${s.product}/${s.module}`.padEnd(30)}${'error'.padStart(8)}`);
    continue;
  }
  console.log(
    `${`${s.product}/${s.module}`.padEnd(30)}${String(s.expected ?? '?').padStart(8)}` +
      `${String(s.downloaded).padStart(12)}  ${s.expected === 0 ? '-' : s.reconciled ? 'yes' : 'NO'}`,
  );
}

const mismatches = summary.filter((s) => s.error || (s.expected > 0 && !s.reconciled));
writeFileSync(
  join(OUT_DIR, 'bulk-read-report.json'),
  JSON.stringify({ startedAt: new Date(started).toISOString(), creditsUsed, summary }, null, 2),
);
if (mismatches.length > 0) {
  console.log(`\n${mismatches.length} module(s) did not reconcile. Nothing should be imported yet.`);
  process.exit(1);
}
console.log('\nEvery module reconciled against its own count endpoint.');
