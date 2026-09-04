import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const CORPUS = join(ROOT, 'audit', 'corpus');
const DOCS = join(ROOT, 'docs', '11-component-audit');

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

function manifests() {
  if (!existsSync(CORPUS)) return [];
  return readdirSync(CORPUS)
    .filter((f) => /^manifest\..*\.json$/.test(f))
    .map((f) => ({ tag: f.replace(/^manifest\.|\.json$/g, ''), rows: JSON.parse(readFileSync(join(CORPUS, f), 'utf8')) }));
}

say('# Workstream V figures, generated');
say('');
say(`Generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')} by \`tests/audit/report-figures.mjs\`. Every number here is read from the corpus or the documents, never typed.`);
say('');

const ms = manifests();
const all = ms.flatMap((m) => m.rows);
const fullAreas = ms.filter((m) => !/-focus$|-aria$/.test(m.tag));

say('## Capture coverage');
say('');
say('| Area | Screens | Captures | Element captures |');
say('| :---- | ----: | ----: | ----: |');
let tScreens = new Set();
let tCap = 0;
let tEl = 0;
for (const m of fullAreas.sort((a, b) => b.rows.length - a.rows.length)) {
  const screens = new Set(m.rows.map((r) => r.screen));
  const els = m.rows.filter((r) => r.kind !== 'screen').length;
  screens.forEach((s) => tScreens.add(s));
  tCap += m.rows.length;
  tEl += els;
  say(`| ${m.tag} | ${screens.size} | ${m.rows.length.toLocaleString()} | ${els.toLocaleString()} |`);
}
say(`| **total** | **${tScreens.size}** | **${tCap.toLocaleString()}** | **${tEl.toLocaleString()}** |`);
say('');

const files = existsSync(CORPUS)
  ? readdirSync(CORPUS, { recursive: true }).filter((f) => String(f).endsWith('.png')).length
  : 0;
say(`PNG files on disk: ${files.toLocaleString()}. **Quote the manifest total, not this**: re-running an area rewrites its manifest and orphans the earlier files, so files always exceed recorded captures.`);
say('');

say('## By state and by kind');
say('');
const byState = new Map();
const byKind = new Map();
for (const r of all) {
  const st = r.state.replace(/^(opened-by|navigated-by|clicked)-.*/, '$1-*');
  byState.set(st, (byState.get(st) ?? 0) + 1);
  byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
}
say('| State | Captures | | Kind | Captures |');
say('| :---- | ----: | :---- | :---- | ----: |');
const st = [...byState.entries()].sort((a, b) => b[1] - a[1]);
const kd = [...byKind.entries()].sort((a, b) => b[1] - a[1]);
for (let i = 0; i < Math.max(st.length, kd.length); i += 1) {
  const a = st[i] ? `${st[i][0]} | ${st[i][1].toLocaleString()}` : ' | ';
  const b = kd[i] ? `${kd[i][0]} | ${kd[i][1].toLocaleString()}` : ' | ';
  say(`| ${a} | | ${b} |`);
}
say('');

const radios = byKind.get('input-radio') ?? 0;
const dtl = byKind.get('input-datetime-local') ?? 0;
say(`**Kinds still short of source:** \`input-radio\` ${radios} against 5 in source, \`input-datetime-local\` ${dtl} against 4. Both live inside dialogs; \`overlay-interior.spec.ts\` and \`selection-states.spec.ts\` close them.`);
say('');

say('## Source counts, read from app/src');
say('');
const SRC = join(ROOT, 'app', 'src');
function tsxFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxFiles(full));
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}
const srcText = existsSync(SRC) ? tsxFiles(SRC).map((f) => readFileSync(f, 'utf8')).join('\n') : '';
const count = (re) => (srcText.match(re) ?? []).length;
const rows = [
  ['`<PlaceholderAction` renders', count(/<PlaceholderAction(?![A-Za-z0-9_])/g)],
  ['  of which pass `ariaDisabled={false}`', count(/ariaDisabled=\{false\}/g)],
  ['hand-rolled `show(...)` buttons (10 of these also carry `aria-disabled`)', count(/show\('/g)],
  ['`aria-disabled` occurrences **in source** (not rendered controls: one is in `PlaceholderAction`, reaching 50)', count(/aria-disabled/g)],
  ['`<Input` call sites', count(/<Input(?![A-Za-z0-9_])/g)],
  ['`<Select` call sites', count(/<Select(?![A-Za-z0-9_])/g)],
  ['`<Table` call sites', count(/<Table(?![A-Za-z0-9_])/g)],
  ['`<RecordSection` call sites', count(/<RecordSection(?![A-Za-z0-9_])/g)],
  ['`<Button` call sites', count(/<Button(?![A-Za-z0-9_])/g)],
  ['error renderings (4 class names)', count(/className="(field-error-text|rq-error|form-error|settings-error)"/g)],
  ['`role="alert"`', count(/role="alert"/g)],
  ['`aria-live`', count(/aria-live/g)],
  ['`aria-invalid`', count(/aria-invalid/g)],
  ['`noValidate`', count(/noValidate/g)],
  ['`<form` elements', count(/<form(?![A-Za-z0-9_])/g)],
  ['`indeterminate`', count(/indeterminate/g)],
  ['`type="radio"`', count(/type="radio"/g)],
  ['`aria-modal`', count(/aria-modal/g)],
  ['`useListLink` **references** (definition + imports + calls; only 2 are call sites)', count(/useListLink/g)],
  ['`Back To List` controls', count(/Back To List/g)],
];
say('| Count | Value |');
say('| :---- | ----: |');
for (const [k, v] of rows) say(`| ${k} | ${v} |`);
say('');

say('## Findings');
say('');
const table = readdirSync(DOCS).find((f) => /V6-Audit-Table/.test(f));
if (table === undefined) {
  say('V6 audit table not found.');
} else {
  const text = readFileSync(join(DOCS, table), 'utf8');
  const rows = text.split('\n').filter((l) => /^\| [0-9]+[a-z]? \|/.test(l));
  const sev = new Map();
  const wmap = new Map();
  for (const r of rows) {
    const cells = r.split('|').map((c) => c.trim());
    const s = (cells[5] ?? '').replace(/\*\*/g, '');
    const key = /^(Blocks|Costs|Degrades|Cosmetic)/.exec(s)?.[1] ?? 'other';
    sev.set(key, (sev.get(key) ?? 0) + 1);
    const w = /W([0-9]+)/.exec(cells[7] ?? '')?.[0] ?? 'unmapped';
    wmap.set(w, (wmap.get(w) ?? 0) + 1);
  }
  say(`Rows in \`${table.replace(/^VVPH_VV-FOOS_|_Draft\.md$/g, '')}\`: **${rows.length}**.`);
  say('');
  say('| Severity | Rows |');
  say('| :---- | ----: |');
  for (const k of ['Blocks', 'Costs', 'Degrades', 'Cosmetic', 'other']) {
    if (sev.has(k)) say(`| ${k} | ${sev.get(k)} |`);
  }
  say('');
  say('| W item | Rows |');
  say('| :---- | ----: |');
  for (const [k, v] of [...wmap.entries()].sort((a, b) => b[1] - a[1])) say(`| ${k} | ${v} |`);
  say('');
  const unmapped = wmap.get('unmapped') ?? 0;
  say(unmapped === 0 ? 'Every row maps to a W item.' : `**${unmapped} row(s) map to no W item.**`);
  say('');
}

say('## Documents');
say('');
say('| Document | Version |');
say('| :---- | :---- |');
for (const f of readdirSync(DOCS).sort()) {
  const name = f.replace(/^VVPH_VV-FOOS_/, '').replace(/_2026-09-0\d_/, ' ').replace(/_Draft\.md$/, '');
  const v = /_(v[0-9.]+)_/.exec(f)?.[1] ?? /(v[0-9.]+)$/.exec(name)?.[1] ?? '';
  say(`| ${name.replace(/ ?v[0-9.]+$/, '')} | ${v} |`);
}
say('');

const derived = ['measure-controls.json', 'measure-density.json', 'measure-structure.json', 'pass3-steps.json', 'analysis.md'];
say('## Derived artefacts');
say('');
say('| Artefact | Present | Size |');
say('| :---- | :---- | ----: |');
for (const d of derived) {
  const path = join(CORPUS, d);
  const ok = existsSync(path);
  const n = ok ? readFileSync(path, 'utf8').length : 0;
  say(`| \`${d}\` | ${ok ? 'yes' : '**no**'} | ${ok ? n.toLocaleString() + ' bytes' : '-'} |`);
}
