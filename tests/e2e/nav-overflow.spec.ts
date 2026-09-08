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

  test('quick search is labelled and targeted for the module you are in', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.fo-sidebar')).toContainText('Candidate Keywords');

    await gotoAsSignedIn(page, '/sales/deals');
    await expect(
      page.locator('.fo-sidebar'),
      'a deals page must not ask for Candidate Keywords',
    ).toContainText('Deal Keywords');
    await expect(page.locator('.fo-sidebar')).not.toContainText('Candidate Keywords');

    await gotoAsSignedIn(page, '/sales/companies');
    await expect(page.locator('.fo-sidebar')).toContainText('Account Keywords');

    await gotoAsSignedIn(page, '/recruit/requisitions');
    await expect(page.locator('.fo-sidebar')).toContainText('Requisition Keywords');
    await expect(
      page.locator('.fo-sidebar'),
      'first and last name only make sense where the record is a person',
    ).not.toContainText('First Name');
  });

  test('searching from the deals page lands on deals, not candidates', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/sales/deals');

    await page.locator('.fo-qs-input-row input').first().fill('acme');
    await page
      .locator('.fo-sidebar')
      .getByRole('button', { name: 'Search', exact: true })
      .first()
      .click();

    await expect
      .poll(() => page.url(), { timeout: 20000 })
      .toMatch(/\/sales\/deals\?search=acme/);
  });
});
