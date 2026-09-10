import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('L8 and L10: hidden nav tabs are discoverable, and quick search follows the module', () => {
  test('at a wide viewport nothing overflows and no scroll control is shown', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const wrap = page.locator('.fo-primary-nav-wrap');
    await expect(wrap).toHaveAttribute('data-overflowing', 'none', { timeout: 20000 });
    await expect(page.locator('.fo-nav-scroll-btn').first()).toBeHidden();
  });

  test('at 1024 the nav reports overflow and offers a reachable scroll control', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const wrap = page.locator('.fo-primary-nav-wrap');
    await expect
      .poll(() => wrap.getAttribute('data-overflowing'), { timeout: 20000 })
      .not.toBe('none');

    const forward = page.getByRole('button', { name: 'Scroll the navigation right' });
    await expect(forward, 'hidden tabs must be discoverable, not just scrollable').toBeVisible();

    const before = await page.locator('.fo-primary-nav').evaluate((el) => el.scrollLeft);
    await forward.click();
    await expect
      .poll(() => page.locator('.fo-primary-nav').evaluate((el) => el.scrollLeft), {
        timeout: 10000,
      })
      .toBeGreaterThan(before);

    await expect(page.getByRole('button', { name: 'Scroll the navigation left' })).toBeVisible();
  });

  test('the list search is the one scoped to the module you are in', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    for (const [route, label] of [
      ['/recruit/candidates', 'Search Candidates'],
      ['/recruit/requisitions', 'Search Requisitions'],
      ['/sales/deals', 'Search Deals'],
      ['/sales/companies', 'Search Accounts'],
    ] as const) {
      await gotoAsSignedIn(page, route);
      await expect(
        page.getByRole('searchbox', { name: label }),
        `${route} must name its own search box, since the sidebar no longer does`,
      ).toBeVisible({ timeout: 25000 });
      await expect(
        page.locator('.fo-sidebar'),
        'the sidebar carries no module-specific keyword box any more',
      ).not.toContainText('Keywords');
    }
  });

  test('searching from the deals page lands on deals, not somewhere else', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/sales/deals');

    const box = page.getByRole('searchbox', { name: 'Search Deals' });
    await expect(box).toBeVisible({ timeout: 25000 });
    await box.fill('acme');
    await box.press('Enter');

    await page.waitForTimeout(800);
    expect(page.url(), 'a list search stays on its list').toContain('/sales/deals');
  });
});
