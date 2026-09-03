import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const LARGE_TABLES = [
  'people',
  'candidate_profiles',
  'candidate_list',
  'applications',
  'activities',
  'attachments',
  'notes',
  'requisition_owners',
  'audit_log',
  'events_outbox',
  'deals',
  'tickets',
  'companies',
  'requisitions',
];

const COMPLETED_BY_CALLER = /^\s*(return|export (async )?function|const \w+ = \(\)|=>)\s*/;

const BOUNDED = /\.range\(|\.limit\(|\.single\(|\.maybeSingle\(|\.csv\(|head:\s*true/;
const NARROWED = /\.eq\(|\.in\(|\.is\(|\.match\(|\.filter\(|\.contains\(|\.overlaps\(/;

const files = execSync(`grep -rl "from('" app/src --include='*.ts' --include='*.tsx'`, {
  encoding: 'utf8',
})
  .trim()
  .split('\n')
  .filter(Boolean);

const findings = [];

for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const table = /\.from\('([a-z_]+)'\)/.exec(lines[i]);
    if (!table || !LARGE_TABLES.includes(table[1])) continue;

    const window = lines.slice(i, i + 8).join(' ');
    const from = window.indexOf(".from('");
    const rest = window.slice(from);
    const nextClient = /(supabase|dashDb)\s*\./.exec(rest.slice(1));
    const stops = [rest.indexOf(';'), nextClient ? nextClient.index + 1 : -1].filter((n) => n > 0);
    const chain = stops.length ? rest.slice(0, Math.min(...stops)) : rest;

    if (!/\.select\(/.test(chain)) continue;
    if (BOUNDED.test(chain) || NARROWED.test(chain)) continue;

    if (COMPLETED_BY_CALLER.test(lines[i])) continue;

    const assigned = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:supabase|dashDb)/.exec(lines[i]);
    if (assigned) {
      const after = lines.slice(i, i + 12).join(' ');
      const used = new RegExp(`\\b${assigned[1]}\\s*\\.(eq|in|is|match|filter|range|limit|contains|overlaps)\\(`);
      if (used.test(after)) continue;
    }

    findings.push({ where: `${file.replace('app/src/', '')}:${i + 1}`, table: table[1] });
  }
}

if (findings.length > 0) {
  console.error(
    `${findings.length} unbounded read(s) of a large table.\n\n` +
      'PostgREST caps a select with no range at max_rows, which supabase/config.toml sets\n' +
      'to 1000. Past that the request does not fail, it silently returns the first 1000\n' +
      'rows, so anything counted or matched from the result is quietly wrong. Bound the\n' +
      'query with .range() through fetchAllRows, narrow it with .eq()/.in(), or take a\n' +
      'page with .limit().\n',
  );
  for (const f of findings) {
    console.error(`  ${f.table.padEnd(20)} ${f.where}`);
  }
  process.exit(1);
}

console.log(
  `${files.length} file(s) checked. No unbounded reads of a large table. Queries returned ` +
    'from a helper, or narrowed through the variable they are assigned to, are completed by ' +
    'their caller and are not counted.',
);
