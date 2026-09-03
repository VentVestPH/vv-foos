import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const UNIQUE_TIE_BREAKERS = ['id', 'person_id', 'zoho_id', 'display_code', 'email'];

const SEARCH_DIRS = ['app/src', 'migration', 'scripts', 'tests'];

const files = execSync(
  `grep -rl "\\.range(\\|\\.limit(" ${SEARCH_DIRS.join(' ')} --include='*.ts' --include='*.tsx' --include='*.mjs' || true`,
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .filter((f) => !f.endsWith('check-paged-order.mjs'));

const findings = [];

function chainAround(lines, index) {
  let start = index;
  while (start > 0 && !/\.from\(|\bsupabase\b|\bdb\b|\bdashDb\b/.test(lines[start])) {
    if (index - start > 14) break;
    start -= 1;
  }
  let end = index;
  while (end < lines.length - 1 && !/;\s*$|\),\s*$|\)\s*$/.test(lines[end])) {
    if (end - index > 8) break;
    end += 1;
  }
  return lines.slice(start, end + 1).join('\n');
}

function helperBodies(source, chain) {
  const names = new Set(
    [...chain.matchAll(/\b(\w*[Bb]aseQuery|apply\w+)\s*\(/g)].map((m) => m[1]),
  );
  let extra = '';
  const lines = source.split('\n');
  for (const name of names) {
    const start = lines.findIndex((l) =>
      new RegExp(`(const|let|function)\\s+${name}\\b`).test(l),
    );
    if (start >= 0) extra += `\n${lines.slice(start, start + 24).join('\n')}`;
  }
  return extra;
}

function insideStringLiteral(line, index) {
  const before = line.slice(0, index);
  const singles = (before.match(/'/g) ?? []).length;
  const doubles = (before.match(/"/g) ?? []).length;
  return singles % 2 === 1 || doubles % 2 === 1;
}

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const at = lines[i].indexOf('.range(');
    if (at < 0) continue;
    if (insideStringLiteral(lines[i], at)) continue;
    const chain = chainAround(lines, i) + helperBodies(source, chainAround(lines, i));
    if (/\.single\(|\.maybeSingle\(|head:\s*true/.test(chain)) continue;

    const orders = [...chain.matchAll(/\.order\(\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const dynamic = /\.order\(\s*[a-zA-Z]/.test(chain);

    if (orders.length === 0 && !dynamic) {
      findings.push({
        file,
        line: i + 1,
        why: 'pages with .range() and never calls .order()',
      });
      continue;
    }
    if (!dynamic && !orders.some((c) => UNIQUE_TIE_BREAKERS.includes(c))) {
      findings.push({
        file,
        line: i + 1,
        why: `orders only by ${orders.join(', ')}, none of which is unique`,
      });
    }
  }
}

console.log(`${files.length} file(s) checked for paged reads without a stable order.`);

if (findings.length === 0) {
  console.log('Every paged read orders by a column that breaks ties uniquely.');
  process.exit(0);
}

console.error(
  '\nPostgres does not guarantee row order without ORDER BY, so OFFSET paging over an\n' +
    'unordered or non-unique order returns some rows twice and never returns others.\n' +
    'This is not a slow query, it is a wrong one, and it is silent.\n',
);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  ${f.why}`);
}
console.error(
  '\nAdd a unique tie-breaker, for example .order(\'id\', { ascending: true }) after the\n' +
    'sort the screen actually wants, or page by keyset with .gt() on that column.',
);
process.exit(1);
