#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';

// Commented-out code, not prose that happens to contain the word "for" or
// "while". Requires a statement START plus a code operator, which is what
// separates `const x = f();` from "True for routes this tab should match".
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
    // Commented-out code: reads as code and is not prose.
    // Real commented-out code is short and ends like a statement. Prose that
    // merely mentions an identifier or a parenthetical does neither.
    const endsLikeCode = /[;{},)]$/.test(body);
    const shortEnough = body.split(/\s+/).length <= 8;
    if (STARTS_AS_CODE.test(body) && HAS_CODE_OP.test(body) && endsLikeCode && shortEnough) {
      findings.push({ at, kind: 'commented-out-code', text: body.slice(0, 60) });
      return;
    }
    // Restates the very next code line: most words already appear in it.
    const next = (lines[i + 1] || '').trim();
    if (next && !next.startsWith('//') && !next.startsWith('*')) {
      const words = body.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
      if (words.length >= 2) {
        const inCode = words.filter((w) => next.toLowerCase().includes(w)).length;
        // A short comment whose words mostly appear in the next line is
        // restating it. Long comments are usually explaining something, so
        // they need a higher bar before being called noise.
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

const files = process.argv.slice(2).filter((f) => CHECKED.test(f) && existsSync(f));
if (files.length === 0) process.exit(0);

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
