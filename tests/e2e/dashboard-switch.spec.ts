import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('K13: Switch to My Dashboard goes somewhere, and comes back', async ({ page }) => {
  await gotoAsSignedIn(page, '/');
  await expect(page.getByRole('heading', { name: /^My View:/ })).toBeVisible({ timeout: 25000 });

  await page.getByRole('link', { name: 'Switch to My Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Pipeline: Home' })).toBeVisible({
    timeout: 25000,
  });
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);

  await page.getByRole('link', { name: 'Switch to My View' }).click();
  await expect(page.getByRole('heading', { name: /^My View:/ })).toBeVisible({ timeout: 25000 });
});

test('K12: the dashboard settings gear sits on the same row as the switch control', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/');
  const row = page.locator('.fo-page-header-title-row');
  await expect(row.getByRole('link', { name: 'Switch to My Dashboard' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Dashboard settings' })).toBeVisible();

  const link = await row.getByRole('link', { name: 'Switch to My Dashboard' }).boundingBox();
  const gear = await row.getByRole('button', { name: 'Dashboard settings' }).boundingBox();
  expect(link, 'the switch control must be laid out').not.toBeNull();
  expect(gear, 'the gear must be laid out').not.toBeNull();
  const linkMid = link!.y + link!.height / 2;
  const gearMid = gear!.y + gear!.height / 2;
  expect(
    Math.abs(linkMid - gearMid),
    'the gear and the switch control must share a horizontal line',
  ).toBeLessThanOrEqual(2);
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
