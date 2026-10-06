import { execFileSync } from 'node:child_process';
import { ROOT, DB_URL, assertConfig, assertTarget } from './local-stack.mjs';

const [command, target] = process.argv.slice(2);
assertConfig();
if (!['check', 'validate'].includes(command)) throw new Error('Expected check or validate.');
const url = assertTarget(target ?? process.env.FOOS_LOCAL_DB_URL ?? process.env.DATABASE_URL ?? DB_URL, 'db');
if (command === 'validate') {
  execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-f', 'supabase/tests/validate.sql'], { cwd: ROOT, stdio: 'inherit' });
}
