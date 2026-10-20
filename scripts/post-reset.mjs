import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { ROOT, API_URL, DB_URL as LOCAL_DB_URL, assertConfig, assertTarget, cliEnv, restartService } from './local-stack.mjs';

process.chdir(ROOT);
assertConfig();
assertTarget(process.env.FOOS_SUPABASE_URL ?? API_URL);
assertTarget(process.env.FOOS_TARGET_URL ?? API_URL);
const childEnv = { ...cliEnv(), FOOS_SUPABASE_URL: API_URL, FOOS_TARGET_URL: API_URL };

const PERSONAS_ONLY = process.argv.includes('--personas-only');
const DB_URL = assertTarget(process.env.FOOS_LOCAL_DB_URL ?? LOCAL_DB_URL, 'db');

function readTestPassword() {
  if (process.env.FOOS_QA_TEST_PASSWORD) return process.env.FOOS_QA_TEST_PASSWORD;
  if (existsSync('tests/.env')) {
    const line = readFileSync('tests/.env', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('FOOS_QA_TEST_PASSWORD='));
    if (line) return line.slice('FOOS_QA_TEST_PASSWORD='.length).trim();
  }
  return null;
}

function seedPersonas() {
  const password = readTestPassword();
  if (!password) {
    console.warn(
      'post-reset: no FOOS_QA_TEST_PASSWORD (env or tests/.env). Skipping persona seed.\n' +
        '            Copy tests/.env.example to tests/.env, then run: npm run db:seed:personas',
    );
    return;
  }
  if (/[';\\]/.test(password)) {
    console.error('post-reset: refusing to seed. FOOS_QA_TEST_PASSWORD contains a quote, semicolon or backslash.');
    process.exitCode = 1;
    return;
  }
  execFileSync(
    'psql',
    [DB_URL, '-q', '-v', 'ON_ERROR_STOP=1', '-c', `set foos.qa_test_password = '${password}';`, '-f', 'tests/support/fixtures/personas.sql'],
    { stdio: 'inherit' },
  );
  console.log('post-reset: 4 test personas seeded.');
}

function syncTestAccounts() {
  try {
    const out = execSync('node scripts/sync-test-accounts.mjs --apply', { encoding: 'utf8', cwd: ROOT, env: childEnv });
    const changed = /^(\d+) test account\(s\) now share/m.exec(out)?.[1] ?? '0';
    console.log(`post-reset: ${changed} test account(s) share the configured password.`);
  } catch (e) {
    console.warn(`post-reset: test accounts not synced (${e.message.split('\n')[0]}).`);
  }
}

async function authAnswers(apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/auth/v1/health`, { signal: AbortSignal.timeout(4000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function waitForAuth() {
  const apiUrl = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await authAnswers(apiUrl)) {
      console.log('post-reset: Auth is answering.');
      return;
    }
    await new Promise((r) => setTimeout(r, 750));
  }

  if (!restartService('kong')) return;
  const second = Date.now() + 30000;
  while (Date.now() < second) {
    if (await authAnswers(apiUrl)) {
      console.log('post-reset: Auth is answering after the Kong restart.');
      return;
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  console.warn(
    'post-reset: Auth still returns 5xx through Kong. Every persona sign-in will fail with an\n' +
      'empty error object, which looks like bad credentials but is a stale Kong upstream.',
  );
}

async function waitForStack() {

  const apiUrl = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
  const checks = [
    ['REST', `${apiUrl}/rest/v1/`],
    ['careers-page function', `${apiUrl}/functions/v1/careers-page`],
  ];
  const deadline = Date.now() + 60000;

  for (const [label, url] of checks) {
    let ok = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (res.status < 500) {
          ok = true;
          break;
        }
      } catch {

      }
      await new Promise((r) => setTimeout(r, 750));
    }
    if (!ok) {
      console.warn(`post-reset: ${label} did not become ready within 60s.`);
      return;
    }
  }
  console.log('post-reset: REST and Edge Functions are answering.');
}

function seedLegacyOwners() {
  if (!existsSync('migration/zoho-exports')) return;
  try {
    const out = execSync('node scripts/add-legacy-owners.mjs --apply', { encoding: 'utf8', cwd: ROOT, env: childEnv });
    const created = /Created (\d+) inactive staff row/.exec(out)?.[1] ?? '0';
    console.log(`post-reset: ${created} inactive legacy-owner staff row(s) seeded from the Zoho exports.`);
  } catch (e) {
    console.warn(`post-reset: legacy owners not seeded (${e.message.split('\n')[0]}).`);
  }
}

seedPersonas();
if (!PERSONAS_ONLY) {
  restartService('edge_runtime');
  await waitForStack();
  await waitForAuth();
  syncTestAccounts();
  seedLegacyOwners();
}
