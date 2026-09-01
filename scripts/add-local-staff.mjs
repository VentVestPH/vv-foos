import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const DB_URL = process.env.FOOS_LOCAL_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:55322/postgres';

function isLocal(url) {
  return /@(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url);
}

if (!isLocal(DB_URL)) {
  console.error(`Refusing to run against ${DB_URL}. This script writes a password directly into auth.users and is local-only.`);
  process.exit(1);
}

const [email, name, role] = process.argv.slice(2);
const password = process.env.FOOS_NEW_STAFF_PASSWORD;

if (!email || !name || !role || !password) {
  console.error(`Usage:
  FOOS_NEW_STAFF_PASSWORD='choose-one' npm run db:add-staff -- <email> "<Full Name>" <admin|recruiter|sourcer|bd>

Creates a named local account so development and UAT happen under a real
identity instead of a shared demo persona. Local stack only.`);
  process.exit(1);
}

for (const [label, value] of [['email', email], ['name', name], ['role', role], ['password', password]]) {
  if (/['\;]/.test(value)) {
    console.error(`The ${label} contains a quote, backslash or semicolon; refusing to interpolate it.`);
    process.exit(1);
  }
}

if (!existsSync('scripts/add-local-staff.sql')) {
  console.error('scripts/add-local-staff.sql is missing.');
  process.exit(1);
}

execFileSync(
  'psql',
  [
    DB_URL,
    '-q',
    '-v', 'ON_ERROR_STOP=1',
    '-c', `set foos.new_staff_email = '${email}';`,
    '-c', `set foos.new_staff_name = '${name}';`,
    '-c', `set foos.new_staff_role = '${role}';`,
    '-c', `set foos.new_staff_password = '${password}';`,
    '-f', 'scripts/add-local-staff.sql',
  ],
  { stdio: 'inherit' },
);

const count = readFileSync('scripts/add-local-staff.sql', 'utf8').length > 0 ? 1 : 0;
if (count) console.log(`Sign in at http://localhost:5175 as ${email}.`);
