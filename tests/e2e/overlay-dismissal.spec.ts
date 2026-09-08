import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from './helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('QA-024: Escape closes each utility menu, on every open, not just the first', async ({ page }) => {
  for (const label of ['Administration', 'Help']) {
    for (let round = 1; round <= 2; round += 1) {
      await page.getByRole('button', { name: new RegExp(`^${label}`) }).click();
      await expect(page.locator('.fo-utility-menu')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('.fo-utility-menu')).toHaveCount(0);
    }
  }
});

test('QA-023: the second overlay of a session is dismissable and leaves no click-blocking backdrop', async ({
  page,
}) => {
  for (let round = 1; round <= 3; round += 1) {
    await page.getByRole('button', { name: 'Announcements' }).click();
    const modal = page.locator('.fo-placeholder-modal');
    await expect(modal).toHaveCount(1);
    await expect(modal).not.toHaveAttribute('data-closing', 'true');
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(page.locator('[data-closing="true"]')).toHaveCount(0);
  }

  await page.getByRole('button', { name: 'Announcements' }).click();
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  await expect(page.locator('.fo-placeholder-overlay')).toHaveCount(0);

  await page.getByRole('button', { name: 'Requisitions' }).click();
  await expect(page).toHaveURL(/\/recruit\/requisitions/);
});
