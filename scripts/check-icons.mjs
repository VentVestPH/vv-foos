#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS = 'app/src/styles/tokens.css';

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const tokens = new Map();
for (const m of readFileSync(TOKENS, 'utf8').matchAll(/--icon-([a-z]+)\s*:\s*(\d+)px/g)) {
  tokens.set(m[1], Number(m[2]));
}

const problems = [];
if (tokens.size === 0) problems.push(`${TOKENS}: no --icon-* tokens declared`);

const allowed = new Set(tokens.values());
const floor = Math.min(...allowed);
const scale = [...allowed].sort((a, b) => a - b).join(', ');

let checked = 0;
for (const file of collect('app/src')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bsize\s*(?:=\{|=\s*)(\d+)\b/g)) {
    const px = Number(m[1]);
    checked += 1;
    const line = src.slice(0, m.index).split('\n').length;
    if (px < floor) {
      problems.push(`${file}:${line}: size={${px}} is below the ${floor}px floor`);
    } else if (!allowed.has(px)) {
      problems.push(`${file}:${line}: size={${px}} matches no --icon-* token (scale is ${scale})`);
    }
  }
}

if (checked === 0) problems.push('no size= literals found; the scan is not reaching app/src');

if (problems.length > 0) {
  for (const p of problems) console.error(p);
  console.error(`\n${problems.length} icon-scale problem(s).`);
  process.exit(1);
}

console.log(`${checked} icon size(s) on the ${scale} scale.`);
