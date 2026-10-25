import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('K13: the primary nav moves between the dashboards, and back', async ({ page }) => {
  await gotoAsSignedIn(page, '/');
  await expect(page.getByRole('heading', { name: /^My View:/ })).toBeVisible({ timeout: 25000 });

  await expect(
    page.getByRole('link', { name: /Switch to/ }),
    'the in-page switch links were removed in favour of the nav',
  ).toHaveCount(0);

  await page.locator('.fo-primary-nav').getByRole('button', { name: 'Pipeline' }).click();
  await expect(page.getByRole('heading', { name: 'Pipeline: Home' })).toBeVisible({
    timeout: 25000,
  });
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);

  await page.locator('.fo-primary-nav').getByRole('button', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: /^My View:/ })).toBeVisible({ timeout: 25000 });
});

test('K12: the dashboard settings gear shares the title row with Collapse all', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/');
  const row = page.locator('.fo-page-header-title-row');
  const gear = row.getByRole('button', { name: 'Dashboard settings' });
  const collapse = row.locator('.fo-collapse-all');
  await expect(gear).toBeVisible({ timeout: 25000 });
  await expect(collapse).toBeVisible();

  const gearBox = await gear.boundingBox();
  const collapseBox = await collapse.boundingBox();
  expect(gearBox, 'the gear must be laid out').not.toBeNull();
  expect(collapseBox, 'Collapse all must be laid out').not.toBeNull();
  expect(
    Math.abs(gearBox!.y + gearBox!.height / 2 - (collapseBox!.y + collapseBox!.height / 2)),
    'the two head controls must share a horizontal line',
  ).toBeLessThanOrEqual(2);
  await expect(gear.locator('svg'), 'the gear is an icon button').toHaveCount(1);
});

test('K11: the calendar actions are buttons with a primary and a secondary, and no pipe divider', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/');
  const actions = page.locator('.record-section-inline-actions').first();
  await expect(actions).toBeVisible({ timeout: 25000 });
  await expect(actions.locator('.btn-primary')).toHaveCount(1);
  await expect(actions.locator('.btn-secondary')).toHaveCount(1);
  await expect(actions.locator('.record-section-divider')).toHaveCount(0);
  await expect(actions.getByRole('button', { name: 'New Event' })).toBeVisible();
  await expect(actions.getByRole('button', { name: 'Schedule interview' })).toBeVisible();
});
