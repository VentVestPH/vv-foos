import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('CRM deals', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.bd);
  });

  test('deals list renders the kanban board with stage columns', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await expect(page.getByRole('heading', { name: /^Deals/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Table' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/lead/i, { timeout: 15000 });
  });

  test('switching to table view renders a table', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 15000 });
  });

  test('drill-through query params pre-filter the deals list', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals?stage=negotiation');
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 15000 });

    await expect(page.locator('.filter-rail select').filter({ hasText: /negotiation/i })).toHaveValue(
      'negotiation',
    );

    const dataRows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    const count = await dataRows.count();
    for (let i = 0; i < count; i++) {
      await expect(dataRows.nth(i)).toContainText(/negotiation/i);
    }
  });

  test('an unfiltered deals table shows every seeded deal', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await page.getByRole('button', { name: 'Table' }).click();
    const dataRows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(dataRows).toHaveCount(2);
  });
});
