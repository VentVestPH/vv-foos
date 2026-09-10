import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SEEDED_REQUISITION = 'd0000000-0000-4000-8000-000000000001';

const PATHS: readonly (readonly [string, string])[] = [
  ['requisitions', '/recruit/requisitions'],
  ['requisition record', `/recruit/requisitions/${SEEDED_REQUISITION}`],
  ['requisition edit', `/recruit/requisitions/${SEEDED_REQUISITION}/edit`],
  ['candidates', '/recruit/candidates'],
  ['deals', '/sales/deals'],
  ['new deal', '/sales/deals/new'],
  ['intake', '/intake'],
  ['settings', '/settings'],
  ['employees', '/employees'],
  ['pipeline', '/pipeline'],
];

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('B1: every page carries a trail that names where you are', async ({ page }) => {
  test.setTimeout(300000);
  const offenders: string[] = [];
  const heights = new Set<number>();

  for (const [name, path] of PATHS) {
    await gotoAsSignedIn(page, path);
    const nav = page.locator('nav[aria-label="Breadcrumb"]').first();
    try {
      await expect(nav).toBeVisible({ timeout: 20000 });
    } catch {
      offenders.push(`${name}: no breadcrumb at all`);
      continue;
    }
    const trail = await page.evaluate(() => {
      const el = document.querySelector('nav[aria-label="Breadcrumb"]')!;
      const current = el.querySelector('[aria-current="page"]');
      return {
        crumbs: [...el.querySelectorAll('li')].map((li) => (li.textContent ?? '').trim()),
        links: el.querySelectorAll('a').length,
        current: (current?.textContent ?? '').trim(),
        height: Math.round(el.getBoundingClientRect().height),
      };
    });
    if (trail.crumbs.length < 2) offenders.push(`${name}: only ${trail.crumbs.length} crumb`);
    if (trail.crumbs[0] !== 'Home') offenders.push(`${name}: does not start at Home`);
    if (trail.links < 1) offenders.push(`${name}: nothing in the trail is clickable`);
    if (trail.current === '') offenders.push(`${name}: no crumb marked as the current page`);
    if (/[a-z]/.test(trail.crumbs.at(-1)?.charAt(0) ?? '')) {
      offenders.push(`${name}: the last crumb starts lower case`);
    }
    heights.add(trail.height);
  }

  expect(offenders, 'every page needs a usable trail').toEqual([]);
  expect(
    [...heights],
    'the trail must be the same height on every page, whatever wraps it',
  ).toHaveLength(1);
});

test('B2: a trail link goes back to the list', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await page.locator('.table-wrap tbody tr .link-btn').first().click();
  await expect(page).toHaveURL(/\/recruit\/requisitions\/[0-9a-f-]{36}/, { timeout: 25000 });
  await page.getByRole('link', { name: 'Requisitions', exact: true }).first().click();
  await expect(page).toHaveURL(/\/recruit\/requisitions(\?|$)/, { timeout: 20000 });
});

test('B3: the record page shows a skeleton trail rather than inventing one', async ({ page }) => {
  test.setTimeout(120000);
  let held = false;
  await page.route('**/rest/v1/requisitions?*', async (route) => {
    if (!held) {
      held = true;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    await route.continue().catch(() => undefined);
  });

  await page.goto(`/recruit/requisitions/${SEEDED_REQUISITION}`);
  await expect(page.locator('.fo-head-skeleton')).toBeVisible({ timeout: 15000 });
  const loading = await page.evaluate(() => {
    const head = document.querySelector('.fo-page-head')!;
    return {
      words: (head.textContent ?? '').trim(),
      realIcons: head.querySelectorAll('svg').length,
      bars: head.querySelectorAll('.skeleton-row').length,
    };
  });
  expect(loading.words, 'a loading head must not name a trail it does not know').toBe('');
  expect(loading.realIcons, 'nor render the record icon before the record').toBe(0);
  expect(loading.bars, 'it stands in with bars instead').toBe(2);

  await page.unroute('**/rest/v1/requisitions?*');
  await expect(page.getByRole('link', { name: 'Requisitions', exact: true }).first()).toBeVisible({
    timeout: 25000,
  });
});
