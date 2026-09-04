import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CORPUS = join(process.cwd(), 'audit', 'corpus');

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
