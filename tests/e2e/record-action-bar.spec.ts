import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const CANDIDATE = '/recruit/candidates/b0000000-0000-4000-8000-000000000002';
const REQUISITION = '/recruit/requisitions/d0000000-0000-4000-8000-000000000001';

test('U1: a record page renders its action bar once, not twice', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  for (const [name, path] of [
    ['candidate record', CANDIDATE],
    ['requisition record', REQUISITION],
  ] as const) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('.record-action-bar').first()).toBeVisible({ timeout: 25000 });
    await expect(
      page.locator('.record-action-bar'),
      `${name} must have exactly one action bar`,
    ).toHaveCount(1);
    await expect(page.locator('.fo-record-bottom-bar')).toHaveCount(0);
  }
});

test('U1: the destructive actions sit behind a real menu, and Save profile is the only primary', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, CANDIDATE);
  const bar = page.locator('.record-action-bar');
  await expect(bar).toBeVisible({ timeout: 25000 });

  await expect(
    bar.getByRole('button', { name: 'Delete permanently…' }),
    'the permanent delete must not sit loose in the bar',
  ).toHaveCount(0);
  await expect(bar.getByRole('button', { name: 'Merge duplicate…' })).toHaveCount(0);

  const more = bar.getByRole('button', { name: /^More/ });
  await expect(more, 'the More control must exist and be real').toBeVisible();
  await more.click();

  const menu = page.locator('.fo-action-menu');
  await expect(menu, 'More must open a real menu, not a placeholder').toBeVisible();
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: 'Merge duplicate…' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Delete permanently…' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);

  await expect(bar.locator('.btn-primary'), 'one primary in the bar').toHaveCount(1);
  await expect(bar.locator('.btn-primary')).toHaveText(/Save profile/);
});

test('K18: the page head is opaque and holds the one action bar, so sticky would cover content', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, CANDIDATE);
  await expect(
    page.locator('.record-action-bar'),
    'RecordSkeleton renders its own head bars, so waiting on .fo-page-head alone can measure the loading state',
  ).toBeVisible({ timeout: 25000 });
  const head = page.locator('.fo-page-head');
  await expect(head).toBeVisible({ timeout: 25000 });

  const info = await head.evaluate((el) => ({
    background: getComputedStyle(el).backgroundColor,
    position: getComputedStyle(el).position,
    holdsBar:
      el.querySelector('.record-action-bar') !== null ||
      (el.parentElement?.querySelector('.fo-page-toolbar .record-action-bar') ?? null) !== null,
  }));
  expect(info.background, 'a sticky head must not be see-through').not.toMatch(
    /rgba\(0, 0, 0, 0\)|transparent/,
  );
  expect(info.holdsBar, 'the wrapper must contain the action bar it would carry').toBe(true);
  expect(
    info.position,
    'sticky is deliberately off: it made a dialog combobox report "element is not stable" ' +
      'and failed bulk-actions and erase-candidate. K18 asked for the opaque wrapper so that ' +
      'sticky becomes possible, not for sticky itself',
  ).not.toBe('sticky');
});
