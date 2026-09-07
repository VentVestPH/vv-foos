import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { resolveIds } from './routes';

test('level A: sort header, capped cell, dashboard bar and inline inputs', async ({ page }) => {
  test.setTimeout(150000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);

  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').first()).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(900);

  const sortBtns = page.locator('thead th.sortable .th-sort-btn');
  const sortCount = await sortBtns.count();
  const sortBefore = await page.locator('thead th.sortable').first().getAttribute('aria-sort');
  await sortBtns.first().focus();
  const focused = await page.evaluate(() => document.activeElement?.className ?? '(none)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1600);
  const sortAfter = await page.locator('thead th.sortable').first().getAttribute('aria-sort');
  console.log(
    `PROBE sort buttons=${sortCount} focused="${focused}" before=${sortBefore} after=${sortAfter}`,
  );

  const capped = page.locator('button.cell-capped, button.cell-expanded');
  const cappedCount = await capped.count();
  let before = 'n/a';
  let after = 'n/a';
  let urlChanged = 'n/a';
  if (cappedCount > 0) {
    const urlBefore = page.url();
    const c = capped.first();
    before = String(await c.getAttribute('aria-expanded'));
    await c.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    urlChanged = String(page.url() !== urlBefore);
    after = String(
      await page
        .locator('button.cell-capped, button.cell-expanded')
        .first()
        .getAttribute('aria-expanded', { timeout: 5000 })
        .catch(() => 'unreadable'),
    );
  }
  console.log(
    `PROBE cappedCells=${cappedCount} ariaExpanded ${before} -> ${after} navigatedAway=${urlChanged}`,
  );

  await gotoAsSignedIn(page, '/?tab=pipeline');
  await page.waitForTimeout(2500);
  const invalidNesting = await page.evaluate(
    () => document.querySelectorAll('button.dash-barlist-row div').length,
  );
  console.log(
    `PROBE bars asButton=${await page.locator('button.dash-barlist-row').count()} divsInsideButton=${invalidNesting}`,
  );

  expect(sortCount).toBeGreaterThan(0);
  expect(sortAfter).not.toBe(sortBefore);
  expect(invalidNesting).toBe(0);
});
