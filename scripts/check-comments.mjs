#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const STARTS_AS_CODE = /^(const|let|var|function|return|import|export|await|throw|new|delete|class|type|interface|enum)\b|^[A-Za-z_$][\w$.]*\s*[({=]|^[}\])]/;
const HAS_CODE_OP = /[;{}]|=>|\)\s*[;.]?$|=[^=]/;
const DIVIDER = /^[/*\s]*[-=*_]{6,}/;
const TAG = /\b(TODO|FIXME|XXX|HACK|NOTE TO SELF)\b/i;
const DENSITY_LIMIT = 0.25;
const CHECKED = /\.(ts|tsx|js|jsx|mjs|css)$/;

function stripMarker(line) {
  return line.replace(/^\s*(\/\/+|\/\*+|\*+\/?|#)\s?/, '').trim();
}

export function analyse(file, source) {
  const lines = source.split('\n');
  const findings = [];
  let commentLines = 0;
  let inBlock = false;

  lines.forEach((raw, i) => {
    const t = raw.trim();
    const isLine = t.startsWith('//');
    const opensBlock = t.startsWith('/*');
    const isBlockBody = inBlock || opensBlock;
    if (!isLine && !isBlockBody) return;

    commentLines++;
    if (opensBlock && !t.includes('*/')) inBlock = true;
    else if (inBlock && t.includes('*/')) inBlock = false;

    const body = stripMarker(raw);
    if (!body) return;
    const at = `${file}:${i + 1}`;

    if (DIVIDER.test(t)) {
      findings.push({ at, kind: 'divider', text: t.slice(0, 60) });
      return;
    }
    if (TAG.test(body)) {
      findings.push({ at, kind: 'tag', text: body.slice(0, 60) });
      return;
    }

    const endsLikeCode = /[;{},)]$/.test(body);
    const shortEnough = body.split(/\s+/).length <= 8;
    if (STARTS_AS_CODE.test(body) && HAS_CODE_OP.test(body) && endsLikeCode && shortEnough) {
      findings.push({ at, kind: 'commented-out-code', text: body.slice(0, 60) });
      return;
    }

    const next = (lines[i + 1] || '').trim();
    if (next && !next.startsWith('//') && !next.startsWith('*')) {
      const words = body.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      if (words.length >= 2) {
        const inCode = words.filter((w) => next.toLowerCase().includes(w)).length;

        const bar = words.length <= 4 ? 0.5 : 0.75;
        if (inCode / words.length >= bar) {
          findings.push({ at, kind: 'restates-code', text: body.slice(0, 60) });
        }
      }
    }
  });

  const density = lines.length ? commentLines / lines.length : 0;
  return { findings, commentLines, total: lines.length, density };
}

const SOURCE_ROOTS = ['app/src', 'tests', 'scripts', 'migration', 'supabase/functions'];
const SOURCE_FILES = ['app/vite.config.ts', 'app/eslint.config.js'];
const FUNCTIONAL = /eslint-disable|deno-lint-ignore|@ts-expect-error|@ts-ignore|prettier-ignore|<reference|@jsx|@deno-types/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'test-results' || entry === 'playwright-report') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CHECKED.test(full)) out.push(full);
  }
  return out;
}

function auditAll() {
  const targets = SOURCE_ROOTS.flatMap((d) => walk(d)).concat(SOURCE_FILES.filter((f) => existsSync(f)));
  const offenders = [];
  for (const file of targets) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let inBlock = false;
    lines.forEach((raw, i) => {
      const t = raw.trim();
      const opensBlock = t.startsWith('/*');
      const isComment = t.startsWith('//') || opensBlock || inBlock || / \/\/ | \/\* /.test(raw);
      if (opensBlock && !t.includes('*/')) inBlock = true;
      else if (inBlock && t.includes('*/')) inBlock = false;
      if (isComment && !FUNCTIONAL.test(raw)) offenders.push(`${file}:${i + 1}  ${t.slice(0, 72)}`);
    });
  }
  console.log(`${targets.length} source file(s) checked.`);
  if (offenders.length === 0) {
    console.log('No comments in source.');
    process.exit(0);
  }
  console.error(`${offenders.length} comment(s) in source. Rationale belongs in docs/ or a commit message.`);
  for (const o of offenders.slice(0, 20)) console.error(`  ${o}`);
  if (offenders.length > 20) console.error(`  ...and ${offenders.length - 20} more`);
  process.exit(1);
}

const files = process.argv.slice(2).filter((f) => CHECKED.test(f) && existsSync(f));
if (files.length === 0) auditAll();

let all = [];
let dense = [];
for (const f of files) {
  const r = analyse(f, readFileSync(f, 'utf8'));
  all = all.concat(r.findings);
  if (r.density > DENSITY_LIMIT && r.total > 20) {
    dense.push(`${f}: ${r.commentLines}/${r.total} lines are comments (${Math.round(r.density * 100)}%)`);
  }
}

if (all.length === 0 && dense.length === 0) process.exit(0);

const lines = [];
if (all.length) {
  lines.push(`${all.length} low-value comment(s):`);
  for (const f of all.slice(0, 12)) lines.push(`  ${f.at}  [${f.kind}]  ${f.text}`);
  if (all.length > 12) lines.push(`  ...and ${all.length - 12} more`);
}
if (dense.length) {
  lines.push('Comment density over 25%:');
  for (const d of dense) lines.push(`  ${d}`);
}
lines.push('Keep comments that record WHY (provenance, a spec reference, a non-obvious constraint). Remove ones that restate the code.');

const message = lines.join('\n');
console.log(JSON.stringify({
  systemMessage: message,
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
}));
