#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const LIVE_REF = 'mebfbbvrqdctamnzvbbs';

const args = process.argv.slice(2);
function flag(name) {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return undefined;
  return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
}

const URL_IN = flag('url') || process.env.CUTOVER_SUPABASE_URL;
const ANON_IN = flag('anon') || process.env.CUTOVER_SUPABASE_ANON_KEY;
const SERVICE = process.env.CUTOVER_SERVICE_ROLE_KEY;
const ORIGIN = flag('origin') || process.env.CUTOVER_APP_ORIGIN || '';
const ALLOW_LIVE = flag('allow-live') !== undefined;

const FUNCTIONS = [
  'careers-page',
  'careers-apply',
  'careers-status',
  'google-oauth-start',
  'google-oauth-callback',
  'google-sync',
  'gmail-send',
  'calendar-create-meeting',
  'intake-sheet-fetch',
  'intake-sheet-commit',
  'intake-email-parser',
];

if (!URL_IN || !ANON_IN) {
  console.error(
    'Name the target explicitly. This script deliberately does not read VITE_SUPABASE_URL or\n' +
      'FOOS_SUPABASE_URL, because app/.env points at the live project and picking it up silently\n' +
      'is how an earlier run of this script talked to production.\n\n' +
      '  CUTOVER_SUPABASE_URL=http://127.0.0.1:55321 \\\n' +
      '  CUTOVER_SUPABASE_ANON_KEY=<the local anon key> \\\n' +
      '  node scripts/check-cutover.mjs\n\n' +
      'or pass --url= and --anon=. Optional: CUTOVER_SERVICE_ROLE_KEY for the pg_cron check,\n' +
      'CUTOVER_APP_ORIGIN for the deep-link and careers checks.',
  );
  process.exit(2);
}

if (URL_IN.includes(LIVE_REF) && !ALLOW_LIVE) {
  console.error(
    `Refusing to run against ${LIVE_REF}, which is the live project. Every other migration and\n` +
      'repair tool in this repo refuses a non-local target the same way. Pass --allow-live if that\n' +
      'is genuinely what you want; the checks here are reads and OPTIONS requests, but a cutover\n' +
      'check belongs against the project you are cutting over to, which is the new develop one.',
  );
  process.exit(2);
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(34)} ${detail}`);
}

console.log(`target ${URL_IN}${URL_IN.includes(LIVE_REF) ? '  (LIVE, allowed by --allow-live)' : ''}\n`);

const anon = createClient(URL_IN, ANON_IN, { db: { schema: 'dash' } });
const { error: dashError } = await anon.from('vw_ats_funnel').select('*').limit(1);
if (dashError && dashError.code === 'PGRST106') {
  record('dash exposed to the Data API', false, 'PGRST106: add dash to Exposed schemas. This is QA-001');
} else if (dashError && /permission denied|JWT/i.test(dashError.message)) {
  record('dash exposed to the Data API', true, `reachable, refused by RLS as it should be: ${dashError.message}`);
} else if (dashError) {
  record('dash exposed to the Data API', false, `${dashError.code ?? ''} ${dashError.message}`);
} else {
  record('dash exposed to the Data API', true, 'a dash view answered');
}

async function probe(fn) {
  const res = await fetch(`${URL_IN}/functions/v1/${fn}`, {
    method: 'OPTIONS',
    redirect: 'manual',
  }).catch((e) => e);
  if (res instanceof Error) return { deployed: false, detail: `OPTIONS -> ${res.message}` };
  if (res.status !== 404) return { deployed: true, detail: `OPTIONS -> ${res.status}` };
  const body = await res.text().catch(() => '');
  const gatewayMiss =
    res.headers.get('sb-error-code') === 'NOT_FOUND' ||
    /Function not found/i.test(body) ||
    /"code"\s*:\s*"NOT_FOUND"/.test(body);
  return {
    deployed: !gatewayMiss,
    detail: gatewayMiss
      ? 'OPTIONS -> 404 and the gateway says the function is not there'
      : 'OPTIONS -> 404 from the function itself, so it is deployed',
  };
}

for (const fn of FUNCTIONS) {
  const { deployed, detail } = await probe(fn);
  record(`function ${fn}`, deployed, detail);
}

if (SERVICE) {
  const admin = createClient(URL_IN, SERVICE);
  const { data, error } = await admin.rpc('foos_cutover_cron_jobs').catch(() => ({ data: null, error: null }));
  if (error || data === null) {
    record('pg_cron scheduled jobs', false, 'no RPC to read cron.job; check it in the SQL editor: select jobname from cron.job');
  } else {
    record('pg_cron scheduled jobs', Array.isArray(data) && data.length > 0, JSON.stringify(data));
  }
} else {
  record('pg_cron scheduled jobs', false, 'CUTOVER_SERVICE_ROLE_KEY not set, so this check was skipped rather than passed');
}

if (ORIGIN) {
  const deep = await fetch(`${ORIGIN}/recruit/candidates/00000000-0000-4000-8000-000000000000`, {
    redirect: 'manual',
  }).catch((e) => e);
  const status = deep instanceof Error ? deep.message : deep.status;
  const html = deep instanceof Error ? '' : await deep.text();
  record(
    'SPA rewrite on a deep link',
    !(deep instanceof Error) && status === 200 && html.includes('<div id="root"'),
    `GET -> ${status}`,
  );

  const careers = await fetch(`${URL_IN}/functions/v1/careers-page`, { redirect: 'manual' }).catch((e) => e);
  const cstatus = careers instanceof Error ? careers.message : careers.status;
  record('public careers page', !(careers instanceof Error) && cstatus === 200, `GET -> ${cstatus}`);
} else {
  record('SPA rewrite on a deep link', false, 'CUTOVER_APP_ORIGIN not set, so this check was skipped rather than passed');
  record('public careers page', false, 'CUTOVER_APP_ORIGIN not set, so this check was skipped rather than passed');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} cutover check(s) pass.`);
if (failed.length > 0) {
  console.log('Not ready. Each failing line names what to set.');
  process.exit(1);
}
