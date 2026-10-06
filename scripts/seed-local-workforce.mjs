import { execFileSync } from 'node:child_process';
import { ROOT, DB_URL, assertConfig, assertTarget } from './local-stack.mjs';

process.chdir(ROOT);
assertConfig();
assertTarget(DB_URL, 'db');
execFileSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/seed_workforce.sql'], {
  cwd: ROOT,
  stdio: 'inherit',
});
console.log('Seeded synthetic employees, courses and assignments in the isolated FOOS local database.');
