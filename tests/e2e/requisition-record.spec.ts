import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test('Printable View expands every section and puts them back', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += 1;
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await page.locator('.table-wrap .link-btn').first().click();
  await expect(page).toHaveURL(/\/recruit\/requisitions\/[0-9a-f-]{36}/);
  await page.waitForSelector('.record-section');

  const collapseAll = page.getByRole('button', { name: /all sections$/ });
  await collapseAll.click();
  if ((await page.locator('.record-section[data-open="true"]').count()) > 0) {
    await collapseAll.click();
  }
  await expect
    .poll(async () => page.locator('.record-section[data-open="true"]').count(), { timeout: 15000 })
    .toBe(0);
  const total = await page.locator('.record-section').count();

  await page.getByRole('button', { name: 'Printable View' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed), {
      timeout: 20000,
    })
    .toBe(1);

  await expect
    .poll(async () => page.locator('.record-section[data-open="true"]').count(), {
      timeout: 15000,
      message:
        'the snapshot has to be taken when the button expands, not at beforeprint, or the restore puts back the expanded state it just created',
    })
    .toBe(0);
  expect(total, 'the requisition record keeps its sections').toBeGreaterThan(3);
});
