import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('C1: a utility menu follows the APG keyboard contract, not just Escape', async ({ page }) => {
  await gotoAsSignedIn(page, '/recruit/candidates');
  const trigger = page.getByRole('button', { name: /^Administration/ });
  await expect(trigger).toBeVisible({ timeout: 25000 });

  await trigger.click();
  const menu = page.locator('.fo-utility-menu');
  await expect(menu).toBeVisible();

  const items = menu.getByRole('menuitem');
  const count = await items.count();
  expect(count, 'the menu should offer items').toBeGreaterThan(1);

  await expect(items.first(), 'opening a menu focuses its first item').toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1), 'ArrowDown moves to the next item').toBeFocused();

  await page.keyboard.press('End');
  await expect(items.nth(count - 1), 'End jumps to the last item').toBeFocused();

  await page.keyboard.press('Home');
  await expect(items.first(), 'Home jumps back to the first').toBeFocused();

  await page.keyboard.press('ArrowUp');
  await expect(items.nth(count - 1), 'ArrowUp from the first wraps to the last').toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('C1: ArrowDown on the trigger opens the menu and lands on the first item', async ({ page }) => {
  await gotoAsSignedIn(page, '/recruit/candidates/b0000000-0000-4000-8000-000000000002');
  const more = page.getByRole('button', { name: /^More/ }).first();
  await expect(more).toBeVisible({ timeout: 25000 });

  await more.focus();
  await page.keyboard.press('ArrowDown');
  const menu = page.locator('.fo-action-menu');
  await expect(menu, 'ArrowDown must open the menu').toBeVisible();
  await expect(
    menu.locator('[role="menuitem"]:not([disabled])').first(),
    'focus lands on the first item a keyboard can actually activate, which is what useMenuKeyboard selects for',
  ).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(menu, 'Tab closes the menu').toHaveCount(0);
});
