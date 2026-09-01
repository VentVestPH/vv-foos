import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const PERSONAS_ONLY = process.argv.includes('--personas-only');
const DB_URL = process.env.FOOS_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

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
    [DB_URL, '-q', '-v', 'ON_ERROR_STOP=1', '-c', `set foos.qa_test_password = '${password}';`, '-f', 'tests/fixtures/personas.sql'],
    { stdio: 'inherit' },
  );
  console.log('post-reset: 4 test personas seeded.');
}

function restartEdgeRuntime() {
  // `supabase db reset` restarts storage, auth and realtime but leaves the edge
  // runtime up holding connections to the storage container it just replaced.
  // Any function that uploads (careers-apply, intake-email-parser) then fails
  // with StorageApiError 502 until the runtime is recycled.
  let name;
  try {
    name = execSync("docker ps --format '{{.Names}}' | grep '^supabase_edge_runtime_' | head -1", {
      encoding: 'utf8',
    }).trim();
  } catch {
    name = '';
  }
  if (!name) {
    console.warn('post-reset: no running supabase_edge_runtime_* container found; skipping restart.');
    return;
  }
  execFileSync('docker', ['restart', name], { stdio: 'ignore' });
  console.log(`post-reset: ${name} restarted (clears stale storage connections).`);
}

async function waitForStack() {
  // `supabase db reset` restarts storage, auth and realtime, and the edge
  // runtime is recycled just above. A suite started before they finish sees a
  // 502 from storage or a realtime channel that never joins, which shows up as
  // a single failure on the first run after a reset and none afterwards.
  const apiUrl = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
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
        // not up yet
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

seedPersonas();
if (!PERSONAS_ONLY) {
  restartEdgeRuntime();
  await waitForStack();
}
