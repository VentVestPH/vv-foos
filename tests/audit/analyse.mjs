import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(HERE, '..', '..', 'audit', 'corpus');

function load(name) {
  const path = join(CORPUS, name);
  if (!existsSync(path)) {
    console.error(`missing ${path}. Run the measure spec first.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

const controls = load('measure-controls.json');
const density = load('measure-density.json');

const round = (n) => Math.round(n * 100) / 100;

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(css) {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (m === null) return null;
  const [r, g, b] = m[1].split(',').map((x) => Number.parseFloat(x.trim()));
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  if (x === null || y === null) return null;
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const lines = [];
const say = (s) => {
  lines.push(s);
  console.log(s);
};

say('# V9 and V13, computed from the measured corpus');
say('');
say(`Controls measured: ${controls.length}. Screens measured: ${density.length}.`);
say('');

say('## Every distinct rendered height, by control kind, desktop');
say('');
say('| Kind | Distinct heights | Count | Spread |');
say('| :---- | :---- | ----: | ----: |');
const byKind = new Map();
for (const c of controls) {
  if (c.viewport !== 'desktop') continue;
  if (!byKind.has(c.kind)) byKind.set(c.kind, []);
  byKind.get(c.kind).push(c);
}
for (const [kind, list] of [...byKind.entries()].sort()) {
  const heights = [...new Set(list.map((c) => Math.round(c.height)))].sort((a, b) => a - b);
  const spread = heights.length > 1 ? heights[heights.length - 1] - heights[0] : 0;
  say(`| \`${kind}\` | ${heights.join(', ')} | ${list.length} | ${spread}px |`);
}
say('');

say('## Controls that sit side by side and do not match');
say('');
say('Same screen, same container, tops within 8px of each other, heights differing by 2px or more.');
say('');
say('| Screen | Container | A | B | Heights | Difference |');
say('| :---- | :---- | :---- | :---- | :---- | ----: |');
const pairs = [];
const desktop = controls.filter((c) => c.viewport === 'desktop');
for (let i = 0; i < desktop.length; i += 1) {
  for (let j = i + 1; j < desktop.length; j += 1) {
    const a = desktop[i];
    const b = desktop[j];
    if (a.screen !== b.screen || a.container !== b.container) continue;
    if (Math.abs(a.y - b.y) > 8) continue;
    const diff = Math.abs(a.height - b.height);
    if (diff < 2) continue;
    pairs.push({ a, b, diff });
  }
}
pairs.sort((x, y) => y.diff - x.diff);
const seenPair = new Set();
let shown = 0;
for (const p of pairs) {
  const key = `${p.a.screen}|${p.a.container}|${p.a.kind}|${p.b.kind}|${Math.round(p.diff)}`;
  if (seenPair.has(key)) continue;
  seenPair.add(key);
  if (shown >= 40) break;
  shown += 1;
  say(
    `| ${p.a.screen} | ${p.a.container} | \`${p.a.kind}\` ${round(p.a.height)}px | \`${p.b.kind}\` ${round(p.b.height)}px | ${round(p.a.height)} vs ${round(p.b.height)} | **${round(p.diff)}px** |`,
  );
}
say('');
say(`Distinct mismatched pairs found: ${seenPair.size}. Shown above: ${shown}.`);
say('');

say('## Why the heights differ: the computed values behind them');
say('');
say('| Kind | font-size | line-height | padding | border | height |');
say('| :---- | :---- | :---- | :---- | :---- | ----: |');
const shownKind = new Set();
for (const c of desktop) {
  const key = `${c.kind}|${Math.round(c.height)}`;
  if (shownKind.has(key)) continue;
  shownKind.add(key);
  if (shownKind.size > 30) break;
  say(
    `| \`${c.kind}\` | ${c.fontSize} | ${c.lineHeight} | ${c.paddingTop}/${c.paddingBottom} | ${c.borderTop} | ${round(c.height)}px |`,
  );
}
say('');

say('## V9: the focus ring measured against what is actually painted behind it');
say('');
say('WCAG 1.4.11 requires 3:1 for a non-text indicator. `outline-offset: 1px` puts the ring outside the element, so the surface that matters is the nearest painted ancestor, not the control.');
say('');
const rings = new Map();
for (const c of controls) {
  if (c.ringBackdrop === undefined || c.outlineColor === undefined) continue;
  const ratio = contrast(c.outlineColor, c.ringBackdrop);
  if (ratio === null) continue;
  const key = `${c.outlineColor}|${c.ringBackdrop}|${c.ringBackdropFrom}|${c.container}`;
  const prior = rings.get(key);
  if (prior === undefined) {
    rings.set(key, { ...c, ratio, count: 1, screens: new Set([c.screen]) });
  } else {
    prior.count += 1;
    prior.screens.add(c.screen);
  }
}
const ringRows = [...rings.values()].sort((a, b) => a.ratio - b.ratio);
say('| Ring colour | Painted behind it | From | Container | Ratio | 1.4.11 | Controls | Screens |');
say('| :---- | :---- | :---- | :---- | ----: | :---- | ----: | ----: |');
for (const r of ringRows) {
  say(
    `| ${r.outlineColor} | ${r.ringBackdrop} | \`${r.ringBackdropFrom}\` | ${r.container} | **${round(r.ratio)}:1** | ${r.ratio >= 3 ? 'passes' : '**fails**'} | ${r.count} | ${r.screens.size} |`,
  );
}
const failing = ringRows.filter((r) => r.ratio < 3);
const failingControls = failing.reduce((n, r) => n + r.count, 0);
say('');
say(`Distinct ring-on-backdrop combinations: ${ringRows.length}. Failing 1.4.11: ${failing.length}, covering ${failingControls} measured controls.`);
say('');

say('## Controls whose cursor is not a pointer');
say('');
say('| Kind | Variant | Cursor | Count |');
say('| :---- | :---- | :---- | ----: |');
const cursors = new Map();
for (const c of controls) {
  if (c.cursor === undefined) continue;
  if (c.kind !== 'button' && c.kind !== 'link' && c.kind !== 'tab' && c.kind !== 'summary') continue;
  const key = `${c.kind}|${c.variant}|${c.cursor}`;
  cursors.set(key, (cursors.get(key) ?? 0) + 1);
}
for (const [key, count] of [...cursors.entries()].sort((a, b) => b[1] - a[1])) {
  const [kind, variant, cursor] = key.split('|');
  if (cursor === 'pointer') continue;
  say(`| \`${kind}\` | ${variant} | **${cursor}** | ${count} |`);
}
say('');

say('## Textareas that can be resized horizontally');
say('');
const resizable = controls.filter((c) => c.kind === 'textarea' && c.resize !== undefined && c.resize !== 'vertical' && c.resize !== 'none');
say(`Textareas measured: ${controls.filter((c) => c.kind === 'textarea').length}. Horizontally resizable: ${resizable.length}.`);
say('');
if (resizable.length > 0) {
  say('| Screen | Name | resize |');
  say('| :---- | :---- | :---- |');
  for (const c of resizable) say(`| ${c.screen} | ${c.name} | **${c.resize}** |`);
  say('');
}

say('## V13: page height and wasted vertical space, desktop');
say('');
say('| Screen | Content | Viewports | Empty px | Empty share | Largest single gap |');
say('| :---- | ----: | ----: | ----: | ----: | ----: |');
for (const d of density.filter((x) => x.viewport === 'desktop').sort((a, b) => b.scrollHeight - a.scrollHeight)) {
  say(
    `| ${d.screen} | ${d.scrollHeight}px | ${d.screens} | ${d.emptyPx}px | ${(d.emptyShare * 100).toFixed(1)}% | ${d.largestGapPx}px |`,
  );
}
say('');

say('## Spacing consistency');
say('');
say('| Screen | Label to control | Control to control | Row height | Tallest control in a row |');
say('| :---- | :---- | :---- | ----: | ----: |');
for (const d of density.filter((x) => x.viewport === 'desktop')) {
  const l = [...new Set(d.labelToControl)].sort((a, b) => a - b);
  const c = [...new Set(d.controlToControl)].sort((a, b) => a - b);
  if (l.length === 0 && c.length === 0 && d.rowHeight === null) continue;
  say(
    `| ${d.screen} | ${l.length ? l.join(', ') : 'none'} | ${c.length ? c.join(', ') : 'none'} | ${d.rowHeight ?? 'n/a'} | ${d.rowControlHeight ?? 'n/a'} |`,
  );
}

writeFileSync(join(CORPUS, 'analysis.md'), lines.join('\n'));
console.error(`\nwritten to ${join(CORPUS, 'analysis.md')}`);
