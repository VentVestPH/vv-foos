import { execFileSync } from 'node:child_process';
import { API_URL, DB_URL, ROOT, PROJECT_ID, assertConfig, assertPortsFree, assertTarget, cliEnv, supabase } from './local-stack.mjs';

const [command, ...extra] = process.argv.slice(2);
if (extra.length || !['check', 'start', 'stop', 'status', 'reset'].includes(command)) {
  throw new Error('Usage: node scripts/local.mjs <check|start|stop|status|reset>. Extra flags are not accepted.');
}
assertConfig();
for (const name of ['FOOS_LOCAL_DB_URL', 'DATABASE_URL_LOCAL']) {
  if (process.env[name]) assertTarget(process.env[name], 'db');
}
for (const name of ['FOOS_SUPABASE_URL', 'FOOS_TARGET_URL']) {
  if (process.env[name]) assertTarget(process.env[name]);
}

if (command === 'check' || command === 'start') {
  await assertPortsFree();
  console.log('FOOS configuration and reserved ports are available.');
}
if (command === 'start') supabase(['start'], { stdio: 'inherit' });
if (command === 'stop') supabase(['stop', '--project-id', PROJECT_ID], { stdio: 'inherit' });
if (command === 'status') supabase(['status'], { stdio: 'inherit' });
if (command === 'reset') {
  supabase(['db', 'reset', '--local'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['scripts/post-reset.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...cliEnv(), FOOS_LOCAL_DB_URL: DB_URL, FOOS_SUPABASE_URL: API_URL, FOOS_TARGET_URL: API_URL },
  });
}
