#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MAX = 32;
const TOKENS = 'app/src/styles/tokens.css';
const STYLES = 'app/src/styles';

const CONTROL_SELECTORS = [
  '.btn',
  '.btn-sm',
  '.field input',
  '.input',
  '.field-select',
  '.field-select-option',
  '.date-field-btn',
  '.date-nav-btn',
  '.date-cell',
  '.date-grid-head',
  '.record-section-header',
];

function cssFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

const tokenText = readFileSync(TOKENS, 'utf8');
const tokens = new Map();
for (const m of tokenText.matchAll(/--(control-h[a-z-]*)\s*:\s*(\d+)px/g)) {
  tokens.set(m[1], Number(m[2]));
}

const problems = [];
for (const [name, value] of tokens) {
  if (value > MAX) problems.push(`${TOKENS}: --${name} is ${value}px, over the ${MAX}px control cap`);
}

function resolve(value) {
  const literal = value.match(/^(\d+)px$/);
  if (literal) return Number(literal[1]);
  const token = value.match(/^var\(--(control-h[a-z-]*)\)$/);
  if (token) {
    const found = tokens.get(token[1]);
    return found === undefined ? null : found;
  }
  return null;
}

let checked = 0;
for (const file of cssFiles(STYLES)) {
  const text = readFileSync(file, 'utf8');
  for (const block of text.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = block[1].trim();
    const body = block[2];
    const selectors = selector.split(',').map((s) => s.trim());
    const hit = selectors.find((s) => CONTROL_SELECTORS.some((c) => s === c || s.startsWith(`${c}:`) || s.startsWith(`${c}.`)));
    if (!hit) continue;
    for (const decl of body.matchAll(/(min-height|max-height|height|width)\s*:\s*([^;]+);/g)) {
      const raw = decl[2].trim();
      const px = resolve(raw);
      if (px === null) continue;
      checked += 1;
      if (px > MAX) {
        problems.push(`${file}: "${hit}" sets ${decl[1]} to ${raw} (${px}px), over the ${MAX}px control cap`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join('\n'));
  console.error(
    `\nButtons and single-line fields are capped at ${MAX}px. Klent asked for one control height on 2026-09-07;` +
      ' W25 in the workstream document records which selectors are in scope and why the nav tabs and the kanban column are not.',
  );
  process.exit(1);
}

console.log(`${tokens.size} control-height token(s) and ${checked} declaration(s) are at or under ${MAX}px.`);
