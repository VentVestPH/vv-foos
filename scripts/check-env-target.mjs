#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';

const LOCAL = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/;

function readUrl(path) {
  if (!existsSync(path)) return null;
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith('VITE_SUPABASE_URL='));
  return line ? line.split('=').slice(1).join('=').trim() : null;
}

const target = process.argv.includes('--production') ? 'production' : 'local';
const env = readUrl('app/.env');
const local = readUrl('app/.env.local');
const dev = readUrl('app/.env.development');
const effective = local ?? env;

if (!effective) {
  console.error('No VITE_SUPABASE_URL found in app/.env.local or app/.env.');
  process.exit(1);
}

const isLocal = LOCAL.test(effective);
const host = effective.replace(/^https?:\/\//, '').split('/')[0];

console.log(`dev server  -> ${dev ?? '(unset)'}`);
console.log(`production  -> ${host}${local ? '  (from .env.local)' : ''}`);

if (target === 'production' && isLocal) {
  console.error(
    '\nRefusing: a production build is pointed at the local stack.\n' +
      'app/.env.local overrides app/.env in production mode. Remove it before building to deploy.',
  );
  process.exit(1);
}

if (target === 'local' && !isLocal) {
  console.error(
    '\nA production build here would talk to ' + host + ', which is not the local stack.\n' +
      'That is correct for a real deploy. For local measurement, add app/.env.local\n' +
      'with the two values from app/.env.development, and delete it afterwards.',
  );
  process.exit(1);
}

console.log('\nBuild target is consistent with what was asked for.');
