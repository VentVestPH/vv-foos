import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('N9: the replica has a print stylesheet and Printable View uses it', () => {
  test('print media hides the shell chrome and reveals collapsed sections', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await page.locator('.table-wrap tbody tr .link-btn').first().click();
    await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });

    const screenState = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector('.fo-primary-nav')!).display,
      sidebar: getComputedStyle(document.querySelector('.fo-sidebar')!).display,
    }));
    expect(screenState.nav).not.toBe('none');
    expect(screenState.sidebar).not.toBe('none');

    await page.emulateMedia({ media: 'print' });

    const printState = await page.evaluate(() => ({
      nav: getComputedStyle(document.querySelector('.fo-primary-nav')!).display,
      sidebar: getComputedStyle(document.querySelector('.fo-sidebar')!).display,
      header: getComputedStyle(document.querySelector('.fo-utility-header')!).display,
      contentBg: getComputedStyle(document.querySelector('.shell-content')!).backgroundColor,
    }));

    expect(printState.nav, 'the nav must not print').toBe('none');
    expect(printState.sidebar, 'the sidebar must not print').toBe('none');
    expect(printState.header, 'the utility header must not print').toBe('none');
    expect(printState.contentBg).toBe('rgb(255, 255, 255)');

    await page.emulateMedia({ media: 'screen' });
  });

  test('Printable View is a real control, not a placeholder', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await page.locator('.table-wrap tbody tr .link-btn').first().click();

    const button = page.getByRole('button', { name: 'Printable View' }).first();
    await expect(button).toBeVisible({ timeout: 25000 });
    await expect(button, 'a real action must not be aria-disabled').not.toHaveAttribute(
      'aria-disabled',
      'true',
    );

    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await button.click();
    const printed = await page.evaluate(
      () => (window as unknown as { __printed: number }).__printed,
    );
    expect(printed, 'clicking Printable View must invoke print').toBe(1);
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  });

  test('a list page also prints without its toolbar or pager', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

    await page.emulateMedia({ media: 'print' });
    const state = await page.evaluate(() => ({
      toolbar: getComputedStyle(document.querySelector('.list-page-toolbar')!).display,
      thead: getComputedStyle(document.querySelector('.table thead')!).display,
    }));
    expect(state.toolbar, 'the search toolbar must not print').toBe('none');
    expect(state.thead, 'the header repeats on every printed page').toBe('table-header-group');
    await page.emulateMedia({ media: 'screen' });
  });
});
