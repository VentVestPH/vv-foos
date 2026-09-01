#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_MS = 220;
const FORBIDDEN_PROPS = ['width', 'height', 'top', 'left'];
const SHELL_SELECTORS = [
  '.taleo-utility-header',
  '.taleo-sidebar',
  '.taleo-body',
  '.shell-main',
];

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

const files = collect('app/src');
const problems = [];
let hasReducedMotion = false;
let durations = 0;

for (const file of files) {
  const css = readFileSync(file, 'utf8');
  if (css.includes('prefers-reduced-motion')) hasReducedMotion = true;

  for (const m of css.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)) {
    const ms = m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
    if (ms > 0.02) durations += 1;
    if (ms > MAX_MS) problems.push(`${file}: ${m[0]} exceeds the ${MAX_MS}ms budget`);
  }

  for (const m of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
    for (const prop of FORBIDDEN_PROPS) {
      if (new RegExp(`(^|[\\s,])${prop}([\\s,]|$)`).test(m[1])) {
        problems.push(`${file}: transitions layout property "${prop}"`);
      }
    }
  }

  for (const selector of SHELL_SELECTORS) {
    const block = new RegExp(`\\${selector}\\s*\\{[^}]*\\}`, 'g');
    for (const m of css.matchAll(block)) {
      if (/transition\s*:/.test(m[0]) || /animation\s*:/.test(m[0])) {
        problems.push(`${file}: shell selector ${selector} carries motion`);
      }
    }
  }
}

if (!hasReducedMotion && durations > 0) {
  problems.push('motion exists but no prefers-reduced-motion block was found');
}

console.log(`${durations} duration value(s) across ${files.length} stylesheet(s); budget ${MAX_MS}ms`);
if (problems.length === 0) {
  console.log('Motion budget respected.');
  process.exit(0);
}
for (const p of problems) console.error(`  ${p}`);
process.exit(1);
