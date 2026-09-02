import { test, expect } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from './helpers';

const ROW_HOVER = 'rgb(240, 246, 251)';
const ROW_ALT = 'rgb(250, 250, 250)';
const PRIMARY_PRESSED = 'rgb(46, 109, 164)';
const PRIMARY_IDLE = 'rgb(54, 121, 181)';

test.describe('interaction states survive the cascade', () => {
  test('every table row shows the hover tint, including the zebra-shaded ones', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.goto('/recruit/candidates');
    await expect(page.locator('table.zebra').first()).toBeVisible({ timeout: 20000 });

    await page.evaluate(() => {
      const table = document.createElement('table');
      table.className = 'table zebra';
      table.id = 'cascade-probe';
      table.innerHTML = '<tbody><tr><td>odd</td></tr><tr><td>even</td></tr></tbody>';
      table.style.position = 'fixed';
      table.style.top = '50%';
      table.style.left = '50%';
      table.style.zIndex = '99999';
      document.querySelector('main')!.append(table);
    });

    const rows = page.locator('#cascade-probe tbody tr');
    await expect(rows).toHaveCount(2);
    expect(await rows.nth(1).evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(ROW_ALT);

    for (const index of [0, 1]) {
      const row = rows.nth(index);
      await expect
        .poll(
          async () => {
            await row.hover();
            return row.evaluate((el) => getComputedStyle(el).backgroundColor);
          },
          { timeout: 5000, message: `row ${index} never took the hover tint` },
        )
        .toBe(ROW_HOVER);
      await page.mouse.move(0, 0);
    }
  });

  test('a pressed primary button darkens instead of turning grey', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.goto('/settings');
    const primary = page.locator('.btn-primary').first();
    await expect(primary).toBeVisible({ timeout: 20000 });
    await page.mouse.move(0, 0);
    await expect
      .poll(() => primary.evaluate((el) => getComputedStyle(el).backgroundColor), {
        timeout: 5000,
        message: 'the primary button never settled on its idle colour',
      })
      .toBe(PRIMARY_IDLE);

    await primary.hover();
    await page.mouse.down();
    try {
      await expect
        .poll(() => primary.evaluate((el) => getComputedStyle(el).backgroundColor), {
          timeout: 5000,
          message: 'the held primary button never took its pressed colour',
        })
        .toBe(PRIMARY_PRESSED);
    } finally {
      await page.mouse.up();
    }
  });

  test('printing renders link buttons in black, not link blue', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.goto('/recruit/candidates');
    const link = page.locator('.link-btn').first();
    await expect(link).toBeVisible({ timeout: 20000 });

    const onScreen = await link.evaluate((el) => getComputedStyle(el).color);
    await page.emulateMedia({ media: 'print' });
    const printed = await link.evaluate((el) => getComputedStyle(el).color);
    await page.emulateMedia({ media: null });

    expect(onScreen).not.toBe('rgb(0, 0, 0)');
    expect(printed).toBe('rgb(0, 0, 0)');
  });
});
