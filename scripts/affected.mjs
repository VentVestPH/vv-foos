import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MODULE_AREAS = {
  recruit: ['recruit', 'lists', 'records'],
  sales: ['sales', 'lists', 'records', 'boards'],
  intake: ['intake'],
  dashboards: ['dashboard'],
  settings: ['settings'],
};

const PAGE_AREAS = [
  [/^app\/src\/pages\/(Dashboard|My|TaskGroup|NewCalendar|Calendar)/, ['dashboard']],
  [/^app\/src\/pages\/Workforce/, ['workforce']],
];

const SHARED_APP = /^app\/src\/(components|styles|lib|hooks|shell|auth|App\.tsx|main\.tsx|vite-env\.d\.ts)/;

const A11Y_SPEC = 'e2e/shell/accessibility.spec.ts';

export function plan(files) {
  const areas = new Set();
  const reasons = [];
  let all = false;
  let integration = false;
  let markup = false;

  const note = (file, why) => reasons.push(`${file}: ${why}`);

  for (const file of files) {
    let match;
    if ((match = file.match(/^tests\/e2e\/([^/]+)\//))) {
      areas.add(match[1]);
      note(file, `area ${match[1]}`);
    } else if (/^tests\/(support|config)\//.test(file)) {
      all = true;
      note(file, 'shared test code');
    } else if (/^tests\/(integration|unit)\//.test(file)) {
      integration = integration || file.startsWith('tests/integration/');
    } else if (/^supabase\/(migrations|seed\.sql|tests)/.test(file)) {
      all = true;
      integration = true;
      note(file, 'schema');
    } else if (/^supabase\/functions\//.test(file)) {
      integration = true;
      note(file, 'edge function');
    } else if ((match = file.match(/^app\/src\/modules\/([^/]+)\//))) {
      markup = true;
      const mapped = MODULE_AREAS[match[1]];
      if (mapped === undefined) {
        all = true;
        note(file, `unmapped module ${match[1]}`);
      } else {
        mapped.forEach((area) => areas.add(area));
        note(file, `module ${match[1]}`);
      }
    } else if (file.startsWith('app/src/pages/')) {
      markup = true;
      const mapped = PAGE_AREAS.find(([pattern]) => pattern.test(file));
      if (mapped === undefined) {
        all = true;
        note(file, 'unmapped page');
      } else {
        mapped[1].forEach((area) => areas.add(area));
        note(file, `page ${mapped[1].join(', ')}`);
      }
    } else if (SHARED_APP.test(file)) {
      all = true;
      markup = true;
      note(file, 'shared app code');
    } else if (file.startsWith('app/')) {
      all = true;
      note(file, 'app code outside the known areas');
    }
  }

  const targets = all ? ['e2e'] : [...[...areas].sort().map((area) => `e2e/${area}`), ...(markup ? [A11Y_SPEC] : [])];
  return { all, integration, areas: [...areas].sort(), targets: [...new Set(targets)], reasons };
}

export function changedFiles(base = 'develop') {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
  let mergeBase = base;
  try {
    mergeBase = git('merge-base', 'HEAD', base)[0] ?? base;
  } catch {
    mergeBase = 'HEAD';
  }
  return [...new Set([...git('diff', '--name-only', mergeBase), ...git('ls-files', '--others', '--exclude-standard')])];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = plan(changedFiles(process.argv[2]));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
