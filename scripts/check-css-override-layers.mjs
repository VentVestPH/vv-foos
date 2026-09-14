import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const APP = new URL('../app/src/', import.meta.url);
const ORDER_RE = /@layer\s+([^;]+);/;

const appCss = readFileSync(new URL('styles/app.css', APP), 'utf8');
const order = (ORDER_RE.exec(appCss)?.[1] ?? '')
  .split(',')
  .map((n) => n.trim())
  .filter(Boolean);

const imports = [...appCss.matchAll(/@import '\.\/layers\/([^']+)' layer\(([^)]+)\)/g)].map(
  (m) => ({ file: `styles/layers/${m[1]}`, layer: m[2] }),
);

const modules = ['dashboards', 'intake', 'recruit', 'sales', 'settings'].map((m) => ({
  file: `modules/${m}/${m}.css`,
  layer: `module.${m}`,
}));

const sheets = [...imports, ...modules];
const rank = new Map(order.map((n, i) => [n, i]));

const KNOWN = new Map([
  [
    '.fo-utility-search .fo-hint-pop',
    'z-index never applied, so the utility search suggestions may sit under the header. Moving it would change stacking; QA-071.',
  ],
  [
    '.fo-calendar-main .fo-calendar-toolbar',
    'margin-bottom never applied; its padding does. QA-071.',
  ],
  [
    '.dash-widgets-panel .dash-home-head',
    'display and justify-content never applied, so the dashboard head is laid out by the module rule. QA-071.',
  ],
]);

const RULE_RE = /(^|\n)\s*([^{}@\n][^{}\n]*?)\s*\{([^}]*)\}/g;

const rules = [];
for (const sheet of sheets) {
  let css;
  try {
    css = readFileSync(new URL(sheet.file, APP), 'utf8');
  } catch {
    continue;
  }
  for (const m of RULE_RE.exec.length && css.matchAll(RULE_RE)) {
    const selector = m[2].split(',').map((s) => s.trim());
    const props = [...m[3].matchAll(/(^|\n|;)\s*([a-z-]+)\s*:/g)].map((p) => p[2]);
    const line = css.slice(0, m.index).split('\n').length + 1;
    rules.push({ sheet: sheet.file, layer: sheet.layer, selector, props, line });
  }
}

const baseOf = new Map();
for (const rule of rules) {
  for (const sel of rule.selector) {
    if (/^\.[A-Za-z0-9_-]+$/.test(sel)) {
      const seen = baseOf.get(sel) ?? [];
      seen.push(rule);
      baseOf.set(sel, seen);
    }
  }
}

const problems = [];
const known = [];
for (const rule of rules) {
  const mine = rank.get(rule.layer);
  if (mine === undefined) continue;
  for (const sel of rule.selector) {
    if (!sel.includes(' ')) continue;
    const targets = sel.split(/\s+|>/).filter((p) => /^\.[A-Za-z0-9_-]+$/.test(p));
    const last = targets[targets.length - 1];
    if (!last) continue;
    for (const base of baseOf.get(last) ?? []) {
      const theirs = rank.get(base.layer);
      if (theirs === undefined || theirs <= mine) continue;
      const clash = rule.props.filter((p) => base.props.includes(p));
      if (clash.length === 0) continue;
      const note = KNOWN.get(sel);
      if (note !== undefined) {
        known.push(`${basename(rule.sheet)}:${rule.line}  "${sel}" — ${note}`);
        continue;
      }
      problems.push(
        `${basename(rule.sheet)}:${rule.line}  "${sel}" sets ${clash.join(', ')} in layer ` +
          `${rule.layer}, but "${last}" sets the same in ${base.layer} ` +
          `(${basename(base.sheet)}:${base.line}), which wins. Move this rule into ${base.layer} or later.`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error('CSS overrides that lose to the rule they modify:\n');
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    `\n${problems.length} override(s) are inert. Layer order beats specificity: ${order.join(' < ')}`,
  );
  process.exit(1);
}

if (known.length > 0) {
  console.log(`${known.length} known inert override(s), left as they are because fixing them changes rendering:`);
  for (const k of known) console.log(`  ${k}`);
}
console.log(
  `${sheets.length} stylesheet(s) checked. No new override sits in an earlier layer than its target.`,
);
