import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
  'Python-2.0',
  'CC-BY-4.0',
  'WTFPL',
]);

const REVIEW = new Set([
  'LGPL-3.0',
  'LGPL-3.0-or-later',
  'LGPL-2.1',
  'MPL-2.0',
  'EPL-2.0',
  'CDDL-1.0',
  'Artistic-2.0',
]);

const REFUSE = new Set([
  'GPL-2.0',
  'GPL-3.0',
  'GPL-3.0-or-later',
  'AGPL-3.0',
  'AGPL-3.0-or-later',
  'SSPL-1.0',
  'BUSL-1.1',
  'Elastic-2.0',
  'UNLICENSED',
]);

function normalise(raw) {
  if (!raw) return null;
  const text = typeof raw === 'string' ? raw : (raw.type ?? null);
  if (!text) return null;
  return text.replace(/^\((.*)\)$/, '$1').trim();
}

function parts(expression) {
  return expression
    .split(/\s+(?:OR|AND)\s+/i)
    .map((p) => p.replace(/[()]/g, '').trim())
    .filter(Boolean);
}

function classify(expression) {
  const each = parts(expression);
  if (each.some((p) => ALLOWED.has(p))) return 'allowed';
  if (each.some((p) => REVIEW.has(p))) return 'review';
  if (each.some((p) => REFUSE.has(p))) return 'refuse';
  return 'unknown';
}

const tree = JSON.parse(
  execFileSync('npm', ['ls', '--all', '--json', '--omit=dev'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }),
);

const WORKSPACES = new Set(['foos-app-redesign-2', 'foos-qa']);

function manifestFor(name) {
  for (const base of ['node_modules', 'app/node_modules', 'tests/node_modules']) {
    const candidate = join(base, ...name.split('/'), 'package.json');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const seen = new Map();
function walk(node) {
  for (const [name, child] of Object.entries(node.dependencies ?? {})) {
    if (WORKSPACES.has(name)) {
      walk(child);
      continue;
    }
    const key = `${name}@${child.version ?? '?'}`;
    if (!seen.has(key)) {
      seen.set(key, child.path ?? manifestFor(name));
      walk(child);
    }
  }
}
walk(tree);

const byClass = { allowed: [], review: [], refuse: [], unknown: [] };
for (const [key, path] of seen) {
  let licence = null;
  const manifest = path && path.endsWith('package.json') ? path : path ? join(path, 'package.json') : null;
  if (manifest && existsSync(manifest)) {
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    licence = normalise(pkg.license ?? pkg.licenses?.[0]);
  }
  const expression = licence ?? 'not stated';
  byClass[licence ? classify(licence) : 'unknown'].push(`${key} — ${expression}`);
}

const total = seen.size;
console.log(`${total} runtime dependency package(s) in the tree.`);
console.log(`  ${byClass.allowed.length} permissive (MIT, ISC, Apache-2.0, BSD, 0BSD and similar)`);

let failed = false;

if (byClass.review.length) {
  console.log(`  ${byClass.review.length} weak-copyleft, allowed but worth naming in the handover:`);
  for (const line of byClass.review) console.log(`    ${line}`);
}

if (byClass.unknown.length) {
  failed = true;
  console.error(`\n${byClass.unknown.length} package(s) state no licence this script recognises:`);
  for (const line of byClass.unknown) console.error(`  ${line}`);
  console.error('Add the licence to the allow list once checked, or replace the package.');
}

if (byClass.refuse.length) {
  failed = true;
  console.error(`\n${byClass.refuse.length} package(s) carry a licence this product cannot ship:`);
  for (const line of byClass.refuse) console.error(`  ${line}`);
}

if (process.argv.includes('--list')) {
  console.log('\nEvery runtime dependency and its licence:');
  for (const line of [...byClass.allowed, ...byClass.review].sort()) console.log(`  ${line}`);
}

if (!failed) console.log('\nEvery runtime dependency is permissively licensed.');
process.exit(failed ? 1 : 0);
