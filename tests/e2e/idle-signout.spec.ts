import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from './helpers';

const HOUR = 60 * 60 * 1000;

test.describe('O5: an idle session signs out instead of staying open forever', () => {
  test('warns two minutes out and signs out at the hour', async ({ page }) => {
    await page.clock.install();
    await signIn(page, PERSONA_EMAILS.recruiter);
    await page.goto('/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });

    await page.clock.fastForward(HOUR - 90 * 1000);
    const warning = page.getByRole('alertdialog', { name: 'Still there?' });
    await expect(warning).toBeVisible({ timeout: 10000 });
    await expect(warning).toContainText('signs out in');

    await page.clock.fastForward(2 * 60 * 1000);
    await page.waitForURL(/\/login/, { timeout: 20000 });
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('activity before the warning resets the clock', async ({ page }) => {
    await page.clock.install();
    await signIn(page, PERSONA_EMAILS.recruiter);
    await page.goto('/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });

    await page.clock.fastForward(HOUR - 5 * 60 * 1000);
    await page.mouse.click(5, 400);
    await page.clock.fastForward(HOUR - 5 * 60 * 1000);

    await expect(page.getByRole('alertdialog', { name: 'Still there?' })).toBeHidden();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('keeping the session alive from the warning cancels the sign-out', async ({ page }) => {
    await page.clock.install();
    await signIn(page, PERSONA_EMAILS.recruiter);
    await page.goto('/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });

    await page.clock.fastForward(HOUR - 90 * 1000);
    const warning = page.getByRole('alertdialog', { name: 'Still there?' });
    await expect(warning).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Keep me signed in' }).click();
    await expect(warning).toBeHidden();

    await page.clock.fastForward(10 * 60 * 1000);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });
});
