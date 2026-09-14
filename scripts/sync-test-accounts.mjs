#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

const TEST_ACCOUNTS = [
  'foos.admin@ventvest.com',
  'foos.recruiter@ventvest.com',
  'foos.sourcer@ventvest.com',
  'foos.bd@ventvest.com',
];

const target = process.env.FOOS_TARGET_URL ?? process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target);

if (!isLocal && !ALLOW_REMOTE) {
  console.error(
    `Refusing to touch credentials on ${target} without --allow-remote.\n` +
      'Run the dry run first so the account list is reviewed, then pass the flag deliberately.',
  );
  process.exit(1);
}

function readPassword() {
  if (process.env.FOOS_TEST_ACCOUNT_PASSWORD) return process.env.FOOS_TEST_ACCOUNT_PASSWORD;
  if (process.env.FOOS_QA_TEST_PASSWORD) return process.env.FOOS_QA_TEST_PASSWORD;
  if (existsSync('tests/.env')) {
    const line = readFileSync('tests/.env', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('FOOS_QA_TEST_PASSWORD='));
    if (line) return line.slice('FOOS_QA_TEST_PASSWORD='.length).trim();
  }
  return null;
}

function serviceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isLocal) return null;
  try {
    const env = execSync('supabase status -o env', { encoding: 'utf8' });
    return /^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m.exec(env)?.[1] ?? null;
  } catch {
    return null;
  }
}

const password = readPassword();
if (!password) {
  console.error(
    'No password. Set FOOS_TEST_ACCOUNT_PASSWORD, or FOOS_QA_TEST_PASSWORD, or put the latter in tests/.env.',
  );
  process.exit(1);
}
if (password.length < 12) {
  console.error('Refusing to set a password shorter than 12 characters.');
  process.exit(1);
}

const key = serviceKey();
if (!key) {
  console.error(
    `No service-role key for ${target}.\n` +
      'Set SUPABASE_SERVICE_ROLE_KEY to the key of the project being synced.',
  );
  process.exit(1);
}

const db = createClient(target, key, { auth: { persistSession: false } });

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
    page += 1;
  }
}

const { data: staffRows, error: staffErr } = await db
  .from('staff')
  .select('id, email, role, is_active')
  .in('email', TEST_ACCOUNTS);
if (staffErr) {
  console.error(`Could not read staff: ${staffErr.message}`);
  process.exit(1);
}
const staffByEmail = new Map((staffRows ?? []).map((r) => [r.email.toLowerCase(), r]));

console.log(`${APPLY ? 'Syncing' : 'Dry run'} against ${target}`);
console.log(`${TEST_ACCOUNTS.length} allowlisted test account(s). Nothing outside the list is read or written.\n`);

const plan = [];
for (const email of TEST_ACCOUNTS) {
  const lower = email.toLowerCase();
  const staff = staffByEmail.get(lower);
  const user = await findUser(lower);

  if (!staff && !user) {
    plan.push({ email, action: 'skip', note: 'no staff row and no auth user on this project' });
    continue;
  }
  if (!staff) {
    plan.push({ email, action: 'skip', note: `auth user ${user.id} exists but no staff row; RLS would return no role` });
    continue;
  }
  if (!user) {
    plan.push({ email, action: 'create', id: staff.id, note: `create auth user at staff id, role ${staff.role}` });
    continue;
  }
  if (user.id !== staff.id) {
    plan.push({
      email,
      action: 'refuse',
      note: `auth user ${user.id} does not match staff id ${staff.id}; 19 foreign keys reference staff.id so neither can be repointed here`,
    });
    continue;
  }
  plan.push({ email, action: 'set', id: staff.id, note: `set password, role ${staff.role}` });
}

for (const row of plan) {
  console.log(`  ${row.action.padEnd(7)} ${row.email.padEnd(30)} ${row.note}`);
}

const refused = plan.filter((r) => r.action === 'refuse');
if (refused.length > 0) {
  console.log(`\n${refused.length} account(s) refused. Fix those by hand before relying on them.`);
}

if (!APPLY) {
  const willWrite = plan.filter((r) => r.action === 'set' || r.action === 'create').length;
  console.log(`\nNothing changed. Re-run with --apply to set the shared password on ${willWrite} account(s).`);
  process.exit(0);
}

let changed = 0;
for (const row of plan) {
  if (row.action === 'set') {
    const { error } = await db.auth.admin.updateUserById(row.id, { password });
    if (error) {
      console.error(`  failed  ${row.email}: ${error.message}`);
      continue;
    }
    changed += 1;
  }
  if (row.action === 'create') {
    const { error } = await db.auth.admin.createUser({
      id: row.id,
      email: row.email,
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`  failed  ${row.email}: ${error.message}`);
      continue;
    }
    changed += 1;
  }
}

console.log(`\n${changed} test account(s) now share the same password on ${target}.`);
console.log('Re-running this is a no-op: the password is read from configuration, never generated,');
console.log('so a deploy, a Zoho import or another run cannot drift it.');
