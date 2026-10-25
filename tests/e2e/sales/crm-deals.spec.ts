import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, signIn } from '../../support/e2e-helpers';

test.describe('CRM deals', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.bd);
  });

  test('deals list renders the kanban board with stage columns', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await expect(page.getByRole('heading', { name: /^Deals/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Kanban' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Table' })).toBeVisible();
    await expect(page.locator('body')).toContainText(/lead/i, { timeout: 15000 });
  });

  test('switching to table view renders a table', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 15000 });
  });

  test('drill-through query params pre-filter the deals list', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals?stage=negotiation');
    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 15000 });

    await openFilterRail(page);
    await expect(
      page.locator('.filter-rail').getByRole('combobox', { name: 'Stage' }),
    ).toContainText(/negotiation/i);

    const dataRows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    const count = await dataRows.count();
    for (let i = 0; i < count; i++) {
      await expect(dataRows.nth(i)).toContainText(/negotiation/i);
    }
  });

  test('an unfiltered deals table shows every seeded deal', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await page.getByRole('tab', { name: 'Table' }).click();
    const dataRows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(dataRows.first()).toBeVisible({ timeout: 20000 });

    for (const code of ['DEAL-0001', 'DEAL-0002']) {
      await expect(dataRows.filter({ hasText: code })).toHaveCount(1);
    }
    expect(await dataRows.count()).toBeGreaterThanOrEqual(2);
  });
});
