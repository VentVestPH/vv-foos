#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const APPLY = process.argv.includes('--apply');
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

const PERSONAS = [
  'demo-admin@ventvest.test',
  'rita.demo@ventvest.com',
  'sam.demo@ventvest.com',
  'ben.demo@ventvest.com',
];

const target = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/)/.test(target);
if (!isLocal && !ALLOW_REMOTE) {
  console.error(
    `Refusing to rotate credentials on ${target} without --allow-remote.\n` +
      'Run the dry run first so the account list is reviewed, then pass the flag deliberately.',
  );
  process.exit(1);
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

const key = serviceKey();
if (!key) {
  console.error('No service-role key. Set SUPABASE_SERVICE_ROLE_KEY for the project being rotated.');
  process.exit(1);
}

const db = createClient(target, key, { auth: { persistSession: false } });

function newPassword() {
  return randomBytes(24).toString('base64url');
}

async function findUser(email) {
  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = (data?.users ?? []).find((u) => (u.email ?? '').toLowerCase() === email);
    if (hit) return hit;
    if (!data?.users?.length || data.users.length < 200) return null;
    page += 1;
  }
}

console.log(`${APPLY ? 'Rotating' : 'Rotation dry run'} against ${target}`);

const found = [];
for (const email of PERSONAS) {
  const user = await findUser(email.toLowerCase());
  console.log(`  ${user ? 'found   ' : 'missing '} ${email}`);
  if (user) found.push({ email, id: user.id });
}

if (!APPLY) {
  console.log(`\n${found.length} of ${PERSONAS.length} persona account(s) present.`);
  console.log('Nothing changed. Re-run with --apply to set a fresh random password on each.');
  console.log('The new values print once and are not stored anywhere by this script.');
  process.exit(0);
}

const issued = [];
for (const persona of found) {
  const password = newPassword();
  const { error } = await db.auth.admin.updateUserById(persona.id, { password });
  if (error) {
    console.error(`  failed ${persona.email}: ${error.message}`);
    continue;
  }
  issued.push({ email: persona.email, password });
}

console.log(`\nRotated ${issued.length} account(s). Printed once, stored nowhere:`);
for (const row of issued) console.log(`  ${row.email}  ${row.password}`);
console.log('\nPut the value the test suite should use into tests/.env as FOOS_QA_TEST_PASSWORD.');
console.log('The suite signs in as all four personas, so they need to share one value or the');
console.log('suite needs per-persona variables; sharing one rotated secret is the smaller change.');
