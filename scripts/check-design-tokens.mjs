import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SPACING = new Set([
  'gap', 'row-gap', 'column-gap', 'inset',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
]);

const files = execSync(
  "find app/src -name '*.css' -not -path '*/node_modules/*'",
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean).filter((f) => !f.endsWith('tokens.css'));

const findings = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = /^\s*([a-z-]+):\s*([^;{}]+)/.exec(line);
    if (!m) return;
    const [, prop, value] = m;
    if (!SPACING.has(prop)) return;
    if (value.includes('calc(')) return;
    const raw = value.split(/\s+/).filter((p) => /^-?\d+px$/.test(p) && p !== '0px');
    if (raw.length) {
      findings.push(`${file}:${i + 1}  ${prop}: ${value.trim()}  ->  ${raw.join(', ')}`);
    }
  });
}

const stacking = [];
const colours = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}  ${line.trim()}`;
    if (/^\s*z-index:\s*-?\d/.test(line)) stacking.push(at);
    if (/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(line) && !line.includes('var(')) {
      colours.push(at);
    }
  });
}

if (findings.length) {
  console.error('Raw pixel spacing. Use a token from tokens.css, or add one there:');
  for (const f of findings) console.error(`  ${f}`);
  console.error(
    '\nThe scale is --sp-quarter 2, --sp-half 4, --sp-1 8, --sp-1-5 12, --sp-2 16, --sp-3 24, --sp-4 32,',
  );
  console.error('plus --sp-tight 6, --hairline 1, --cell-pad 10, --btn-pad-x 18, --section-pad 24.');
}

if (stacking.length) {
  console.error('\nRaw z-index. Every layer is named in tokens.css so the order can be read in one place:');
  for (const f of stacking) console.error(`  ${f}`);
  console.error(
    '\n--z-raise 1, --z-sticky 2, --z-page-toolbar 8, --z-action-bar 10, --z-menu 40, --z-overlay 50,',
  );
  console.error(
    '--z-overlay-module 60, --z-toast 70, --z-dialog 100, --z-field-layer 130, --z-utility-hint 300,',
  );
  console.error('--z-recent-settings 400, --z-boot 500.');
}

if (colours.length) {
  console.error('\nRaw colour. Every colour comes from tokens.css:');
  for (const f of colours) console.error(`  ${f}`);
}

if (findings.length || stacking.length || colours.length) process.exit(1);

console.log(
  `${files.length} stylesheet(s) checked. Spacing, stacking order and colour all come from tokens.`,
);
