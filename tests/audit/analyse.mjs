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
const structure = existsSync(join(CORPUS, 'measure-structure.json')) ? load('measure-structure.json') : [];

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
say('> **This file lives in the gitignored corpus and contains live candidate data.** The `name` column of any control that is a record link holds a real candidate or company name, taken from the local Zoho import. Nothing here may be copied into a document in `docs/` without removing those first. Where a finding needs an example, describe the shape and omit the value, as V10 observation 14 does.');
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

say('## Document structure: headings, landmarks and tab order');
say('');
if (structure.length === 0) {
  say('Not measured: `measure-structure.json` is absent.');
  say('');
} else {
  say('| Screen | Viewport | h1 | Headings | Skipped levels | Landmarks | Focusable | tabindex>0 | autofocus | Tab-order inversions |');
  say('| :---- | :---- | ----: | ----: | :---- | ----: | ----: | ----: | ----: | ----: |');
  for (const d of structure.filter((x) => x.viewport === 'desktop')) {
    say(
      `| ${d.screen} | ${d.viewport} | ${d.h1Count} | ${d.headings.length} | ${d.skippedLevels.length > 0 ? d.skippedLevels.join(', ') : 'none'} | ${d.landmarks.length} | ${d.focusableCount} | ${d.positiveTabindex} | ${d.autofocus} | ${d.tabOrderInversions.length} |`,
    );
  }
  say('');
  const noH1 = structure.filter((d) => d.h1Count === 0);
  const manyH1 = structure.filter((d) => d.h1Count > 1);
  const skipped = structure.filter((d) => d.skippedLevels.length > 0);
  const noLandmark = structure.filter((d) => d.landmarks.length === 0);
  const positive = structure.filter((d) => d.positiveTabindex > 0);
  say(`Screens with no \`h1\`: **${noH1.length}** of ${structure.length}. With more than one: **${manyH1.length}**. With a skipped heading level: **${skipped.length}**. With no landmark region at all: **${noLandmark.length}**. Using a positive \`tabindex\`: **${positive.length}**.`);
  say('');
  const worst = [...structure].sort((a, b) => b.tabOrderInversions.length - a.tabOrderInversions.length).slice(0, 6);
  if (worst.length > 0 && worst[0].tabOrderInversions.length > 0) {
    say('The screens where tab order diverges most from reading order, with the first few controls involved:');
    say('');
    say('| Screen | Viewport | Inversions | Examples |');
    say('| :---- | :---- | ----: | :---- |');
    for (const d of worst) {
      if (d.tabOrderInversions.length === 0) continue;
      const eg = d.tabOrderInversions
        .slice(0, 3)
        .map((i) => `${i.name} (DOM ${i.domIndex}, visually ${i.visualIndex})`)
        .join('; ');
      say(`| ${d.screen} | ${d.viewport} | **${d.tabOrderInversions.length}** | ${eg} |`);
    }
    say('');
  }
}

say('## Accessible names: missing, and duplicated within one screen');
say('');
say('Names follow the accessible-name order: `aria-labelledby`, then `aria-label`, then an associated `<label>`, then the element\'s own text. A name that could only be found in `title` or `placeholder` is flagged, because those are the two weakest sources.');
say('');
const nameless = controls.filter((c) => (c.name ?? '') === '');
const weak = controls.filter((c) => /\(from (title|placeholder) only\)$/.test(c.name ?? ''));
say(`Controls with no accessible name at all: **${nameless.length}**. Named only by \`title\` or \`placeholder\`: **${weak.length}**.`);
say('');
if (nameless.length > 0) {
  say('| Screen | Viewport | Kind | Variant | Container |');
  say('| :---- | :---- | :---- | :---- | :---- |');
  for (const c of nameless.slice(0, 30)) say(`| ${c.screen} | ${c.viewport} | \`${c.kind}\` | ${c.variant} | ${c.container} |`);
  say('');
}
if (weak.length > 0) {
  say('| Screen | Kind | Name and its source | Count |');
  say('| :---- | :---- | :---- | ----: |');
  const weakGroups = new Map();
  for (const c of weak) {
    const key = `${c.screen}|${c.kind}|${c.name}`;
    weakGroups.set(key, (weakGroups.get(key) ?? 0) + 1);
  }
  for (const [key, n] of [...weakGroups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    const [screen, kind, name] = key.split('|');
    say(`| ${screen} | \`${kind}\` | ${name} | ${n} |`);
  }
  say('');
}

say('Controls sharing a name with another control on the same screen:');
say('');
say('| Screen | Viewport | Name | Times | Share of that screen\'s controls |');
say('| :---- | :---- | :---- | ----: | ----: |');
const perScreen = new Map();
for (const c of controls) {
  const key = `${c.screen}|${c.viewport}`;
  if (!perScreen.has(key)) perScreen.set(key, []);
  perScreen.get(key).push(c);
}
const dupRows = [];
for (const [key, list] of perScreen.entries()) {
  const counts = new Map();
  for (const c of list) {
    const n = c.name ?? '';
    if (n === '') continue;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  for (const [name, n] of counts.entries()) {
    if (n < 3) continue;
    const [screen, viewport] = key.split('|');
    dupRows.push({ screen, viewport, name, n, share: n / list.length });
  }
}
for (const r of dupRows.sort((a, b) => b.n - a.n).slice(0, 30)) {
  say(`| ${r.screen} | ${r.viewport} | ${r.name} | **${r.n}** | ${(r.share * 100).toFixed(1)}% |`);
}
say('');
const screensAffected = new Set(dupRows.map((r) => `${r.screen}|${r.viewport}`)).size;
say(`Screen and viewport combinations carrying at least one name used three or more times: ${screensAffected}.`);
say('');

say('## WCAG 2.5.8 target size, including the spacing exception');
say('');
say('A target under 24 by 24 still conforms if a 24px-diameter circle centred on it intersects no other target\'s circle. Computed per screen and viewport from the measured boxes.');
say('');
const small = controls.filter((c) => Math.min(c.width, c.height) < 24 && c.kind !== 'screen');
const byScreen = new Map();
for (const c of controls) {
  const key = `${c.screen}|${c.viewport}`;
  if (!byScreen.has(key)) byScreen.set(key, []);
  byScreen.get(key).push(c);
}
const verdicts = [];
for (const c of small) {
  const peers = byScreen.get(`${c.screen}|${c.viewport}`) ?? [];
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  let nearest = Infinity;
  let nearestName = '';
  for (const other of peers) {
    if (other === c) continue;
    const ox = other.x + other.width / 2;
    const oy = other.y + other.height / 2;
    const d = Math.hypot(cx - ox, cy - oy);
    if (d > 0 && d < nearest) {
      nearest = d;
      nearestName = other.name || other.kind;
    }
  }
  verdicts.push({
    screen: c.screen,
    viewport: c.viewport,
    kind: c.kind,
    name: c.name,
    size: `${Math.round(c.width)}x${Math.round(c.height)}`,
    nearest: Number.isFinite(nearest) ? Math.round(nearest) : null,
    nearestName,
    passes: Number.isFinite(nearest) ? nearest >= 24 : true,
  });
}
const failed = verdicts.filter((v) => !v.passes);
say(`Controls under 24px on a side: ${verdicts.length}. Rescued by the spacing exception: ${verdicts.length - failed.length}. **Failing 2.5.8 outright: ${failed.length}.**`);
say('');
if (failed.length > 0) {
  say('| Screen | Viewport | Kind | Name | Size | Nearest target | Distance |');
  say('| :---- | :---- | :---- | :---- | :---- | :---- | ----: |');
  for (const v of failed.sort((a, b) => a.nearest - b.nearest).slice(0, 40)) {
    say(`| ${v.screen} | ${v.viewport} | \`${v.kind}\` | ${v.name} | ${v.size} | ${v.nearestName} | **${v.nearest}px** |`);
  }
  say('');
}
const rescued = verdicts.filter((v) => v.passes);
if (rescued.length > 0) {
  const byKind = new Map();
  for (const v of rescued) byKind.set(v.kind, (byKind.get(v.kind) ?? 0) + 1);
  say('Rescued by spacing, by kind: ' + [...byKind.entries()].map(([k, n]) => `${k} ${n}`).join(', ') + '.');
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
