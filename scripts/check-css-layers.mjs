import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'app/src';
const UNLAYERED_BY_DESIGN = new Set(['app/src/styles/tokens.css']);
const ENTRY = 'app/src/styles/app.css';

function cssFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...cssFiles(path));
    else if (name.endsWith('.css')) out.push(path);
  }
  return out;
}

function topLevelRules(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (ch === '{') {
      if (depth === 0) rules.push(stripped.slice(start, i).trim());
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) start = i + 1;
    } else if (ch === ';' && depth === 0) {
      rules.push(stripped.slice(start, i).trim());
      start = i + 1;
    }
  }
  return rules.filter(Boolean);
}

const problems = [];
const files = cssFiles(ROOT).sort();
const declaredLayers = new Set();

const entry = readFileSync(ENTRY, 'utf8');
for (const rule of topLevelRules(entry)) {
  if (rule.startsWith('@layer ')) {
    for (const name of rule.slice(7).split(',')) declaredLayers.add(name.trim());
  } else if (rule.startsWith('@import')) {
    const layer = /layer\(([^)]+)\)/.exec(rule);
    if (layer) declaredLayers.add(layer[1].trim());
  } else {
    problems.push(`${ENTRY}: the entry sheet must only import and declare layers, found: ${rule.slice(0, 60)}`);
  }
}

for (const file of files) {
  if (file === ENTRY || UNLAYERED_BY_DESIGN.has(file)) continue;
  const css = readFileSync(file, 'utf8');
  const rules = topLevelRules(css);

  if (file.startsWith('app/src/styles/layers/')) {
    const name = file.slice('app/src/styles/layers/'.length, -4);
    if (!declaredLayers.has(name)) {
      problems.push(`${file}: no layer(${name}) import in ${ENTRY}`);
    }
    for (const rule of rules) {
      if (rule.startsWith('@layer')) {
        problems.push(`${file}: already imported into layer(${name}), so it must not declare its own`);
      }
    }
    continue;
  }

  const layered = rules.length === 1 && rules[0].startsWith('@layer ');
  if (!layered) {
    problems.push(
      `${file}: every rule must sit inside one @layer block, found ${rules.length} top-level rule(s): ` +
        rules.slice(0, 3).map((r) => r.slice(0, 40)).join(' / '),
    );
    continue;
  }
  const name = rules[0].slice(7).trim();
  if (!declaredLayers.has(name)) {
    problems.push(`${file}: layer ${name} is not in the order declared by ${ENTRY}`);
  }
}

if (problems.length) {
  console.error(
    'Unlayered CSS beats every layered rule regardless of specificity, so one stray rule\n' +
      'silently outranks the whole stylesheet. Fix these:\n',
  );
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log(
  `${files.length} stylesheet(s) checked. Every rule is in one of the ${declaredLayers.size} declared layers.`,
);
