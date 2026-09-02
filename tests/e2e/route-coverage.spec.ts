import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const APP = '/Users/klentz/Work/VV-FoOS/app/src';

const MODULE_MOUNTS: Record<string, string> = {
  recruit: '/recruit',
  sales: '/sales',
  intake: '/intake',
  settings: '/settings',
  dashboards: '/',
};

const NOT_A_SCREEN = new Set(['*', '/login']);

function pathsIn(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/path="([^"]*)"/g)].map((m) => m[1] as string);
}

function declaredRoutes(): string[] {
  const routes: string[] = [];
  for (const p of pathsIn(`${APP}/App.tsx`)) {
    if (NOT_A_SCREEN.has(p)) continue;
    if (p.endsWith('/*')) continue;
    routes.push(p === '/' ? '/' : `/${p.replace(/^\//, '')}`);
  }
  for (const dir of readdirSync(`${APP}/modules`)) {
    const mount = MODULE_MOUNTS[dir];
    if (!mount) continue;
    let paths: string[];
    try {
      paths = pathsIn(`${APP}/modules/${dir}/index.tsx`);
    } catch {
      continue;
    }
    for (const p of paths) {
      if (NOT_A_SCREEN.has(p)) continue;
      routes.push(`${mount === '/' ? '' : mount}/${p}`.replace('//', '/'));
    }
  }
  return [...new Set(routes)];
}

function axeCoveredRoutes(): string[] {
  const spec = readFileSync('/Users/klentz/Work/VV-FoOS/tests/e2e/accessibility.spec.ts', 'utf8');
  const block = spec.slice(spec.indexOf('const ROUTES'), spec.indexOf('] as const;'));
  return [...block.matchAll(/'(\/[^']*)'/g)].map((m) => (m[1] as string).split('?')[0] as string);
}

test.describe('T5: accessibility coverage tracks the router', () => {
  test('every screen route is either covered by the axe sweep or listed as exempt', () => {
    const EXEMPT = new Set([
      '/recruit/requisitions/:id',
      '/recruit/requisitions/:id/edit',
      '/recruit/candidates/:id',
      '/sales/companies/:id',
      '/sales/contacts/:personId',
      '/sales/deals/:id',
    ]);

    const declared = declaredRoutes();
    expect(declared.length, 'the route scan found nothing, so it is broken').toBeGreaterThan(10);

    const covered = new Set(axeCoveredRoutes());
    const uncovered = declared.filter((r) => !covered.has(r) && !EXEMPT.has(r));

    expect(
      uncovered,
      'these routes exist but no axe route covers them. Add them to accessibility.spec.ts, ' +
        'or to EXEMPT here with a reason (record routes are covered by their own block in that spec)',
    ).toEqual([]);
  });

  test('the exempt list does not name routes that no longer exist', () => {
    const declared = new Set(declaredRoutes());
    const stale = [
      '/recruit/requisitions/:id',
      '/recruit/requisitions/:id/edit',
      '/recruit/candidates/:id',
      '/sales/companies/:id',
      '/sales/contacts/:personId',
      '/sales/deals/:id',
    ].filter((r) => !declared.has(r));
    expect(stale, 'the exemption list has drifted from the router').toEqual([]);
  });
});
