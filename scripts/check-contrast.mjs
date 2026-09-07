#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const TOKENS = 'app/src/styles/tokens.css';

const PAIRS = [
  ['nav band label', '#ffffff', '--fo-nav', 4.5],
  ['sidebar panel header', '#ffffff', '--fo-sidebar-header', 4.5],
  ['section band body text', '--fo-text', '--fo-section', 4.5],
  ['nested band body text', '--fo-text', '--fo-nested-section', 4.5],
  ['count badge text', '--fo-text', '--fo-count', 4.5],
  ['link on surface', '--fo-link', '--fo-surface', 4.5],
  ['save button label', '#ffffff', '--fo-primary', 4.5],
  ['logout label', '#ffffff', '--fo-logout', 4.5],
  ['danger on surface', '--fo-danger', '--fo-surface', 4.5],
  ['secondary text on surface', '--fo-text-secondary', '--fo-surface', 4.5],
  ['body on zebra row', '--fo-text', '--fo-row-alt', 4.5],
  ['body on hover row', '--fo-text', '--fo-row-hover', 4.5],
  ['control border', '--fo-control-border', '--fo-surface', 3.0],
  ['focus ring on surface', '--fo-ink', '--fo-surface', 3.0],
  ['focus ring on the page canvas', '--fo-ink', '--fo-canvas', 3.0],
  ['focus ring on the primary nav', '--fo-ink', '--fo-nav', 3.0],
  ['focus ring on the sidebar header', '--fo-ink', '--fo-sidebar-header', 3.0],
  ['focus ring on a section tint', '--fo-ink', '--fo-section', 3.0],
  ['focus ring halo on the primary nav', '--fo-surface', '--fo-nav', 3.0],
  ['gate tag text', '--fo-text-secondary', '--fo-row-alt', 4.5],
  ['gate tag border', '--fo-control-border', '--fo-row-alt', 3.0],
  ['nav badge count', '--fo-nav', '--fo-surface', 4.5],
  ['table header text', '--fo-text', '--fo-table-head', 4.5],
  ['link on the page band', '--fo-link-on-tint', '--fo-canvas', 4.5],
  ['link on the section tint', '--fo-link-on-tint', '--fo-section', 4.5],
  ['secondary on the section tint', '--fo-tab-label', '--fo-section', 4.5],
  ['body on zebra row alt', '--fo-text', '--fo-row-alt', 4.5],
  ['link on zebra row alt', '--fo-link', '--fo-row-alt', 4.5],
  ['link on hover row', '--fo-link', '--fo-row-hover', 4.5],
  ['link on zebra row', '--fo-link', '--fo-row-alt', 4.5],
  ['chip text on surface', '--fo-link', '--fo-surface', 4.5],
  ['secondary text on canvas', '--fo-text-secondary', '--fo-canvas', 4.5],
  ['body text on canvas', '--fo-text', '--fo-canvas', 4.5],
  ['side tab label on tinted bar', '--fo-tab-label', '--fo-section', 4.5],
];

function readTokens(file) {
  const map = new Map();
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const tokens = readTokens(TOKENS);
const resolve = (v) => (v.startsWith('--') ? tokens.get(v) : v);

let failures = 0;
const rows = [];
for (const [label, fgRef, bgRef, required] of PAIRS) {
  const fg = resolve(fgRef);
  const bg = resolve(bgRef);
  if (!fg || !bg) {
    rows.push(`  MISSING  ${label} (${!fg ? fgRef : bgRef} not found in ${TOKENS})`);
    failures += 1;
    continue;
  }
  const r = ratio(fg, bg);
  const pass = r >= required;
  if (!pass) failures += 1;
  rows.push(`  ${r.toFixed(2).padStart(6)}:1  ${pass ? 'pass' : 'FAIL'}  ${label} (needs ${required})`);
}

console.log(rows.join('\n'));
console.log(failures === 0 ? `\nAll ${PAIRS.length} pairs meet WCAG AA.` : `\n${failures} contrast failure(s).`);
process.exit(failures === 0 ? 0 : 1);
