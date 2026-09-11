#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX_MS = 220;
const CONTINUOUS_TOKENS = ['--motion-spin', '--motion-skeleton', '--motion-attention'];
const OVER_BUDGET_TOKENS = ['--motion-rail'];
const FORBIDDEN_PROPS = ['width', 'height', 'top', 'left'];
const SHELL_SELECTORS = [
  '.fo-utility-header',
  '.fo-body',
  '.shell-main',
];
const SIDEBAR_RAIL = '.fo-sidebar';
const SIDEBAR_RAIL_ALLOWED = /transition:\s*width var\(--motion-rail\) var\(--ease-out\);/;

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

  let scan = css;
  for (const token of OVER_BUDGET_TOKENS) {
    scan = scan.replace(new RegExp(`${token}\\s*:[^;]*;`, 'g'), `${token}:;`);
  }
  for (const token of CONTINUOUS_TOKENS) {
    scan = scan.replace(new RegExp(`${token}\\s*:[^;]*;`, 'g'), `${token}:;`);
    const use = new RegExp(`([a-z-]+)\\s*:\\s*([^;]*var\\(${token}\\)[^;]*);`, 'g');
    for (const m of css.matchAll(use)) {
      if (!/\binfinite\b/.test(m[2])) {
        problems.push(`${file}: ${token} is only for a continuous indicator, but ${m[1]} is not infinite`);
      }
    }
  }

  for (const m of scan.matchAll(/(\d+(?:\.\d+)?)(ms|s)\b/g)) {
    const ms = m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
    if (ms > 0.02) durations += 1;
    if (ms > MAX_MS) problems.push(`${file}: ${m[0]} exceeds the ${MAX_MS}ms budget`);
  }

  for (const m of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
    if (SIDEBAR_RAIL_ALLOWED.test(m[0])) continue;
    for (const prop of FORBIDDEN_PROPS) {
      if (new RegExp(`(^|[\\s,])${prop}([\\s,]|$)`).test(m[1])) {
        problems.push(`${file}: transitions layout property "${prop}"`);
      }
    }
  }

  const railBlock = new RegExp(`\\${SIDEBAR_RAIL}\\s*\\{[^}]*\\}`, 'g');
  for (const m of css.matchAll(railBlock)) {
    const motion = m[0].match(/transition\s*:[^;]*;|animation\s*:[^;]*;/g) ?? [];
    for (const decl of motion) {
      if (!SIDEBAR_RAIL_ALLOWED.test(decl)) {
        problems.push(
          `${file}: ${SIDEBAR_RAIL} may only transition its width over --motion-panel, found ${decl.trim()}`,
        );
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
