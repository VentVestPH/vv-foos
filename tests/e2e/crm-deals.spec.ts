import { expect, test } from '@playwright/test';

const BD_EMAIL = 'ben.demo@ventvest.com';
// SECURITY (QA-003): no literal fallback. The old default was a working
// credential against the live project. See tests/env.ts.
const TEST_PASSWORD = (() => {
  const value = process.env.FOOS_QA_TEST_PASSWORD;
  if (!value) throw new Error('FOOS_QA_TEST_PASSWORD is not set (see tests/.env.example)');
  return value;
})();

test.describe('CRM deals', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(BD_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/(?!login)/, { timeout: 10000 });
  });

  test('deals list renders kanban with stage columns', async ({ page }) => {
    await page.goto('/sales/deals');
    await expect(page.getByRole('heading', { name: /deals/i })).toBeVisible();
    await expect(page.getByText(/lead/i).first()).toBeVisible();
  });

  test('drill-through query params pre-filter the deals list', async ({ page }) => {
    await page.goto('/sales/deals?stage=negotiation');
    // Table view makes the applied filter easiest to assert against.
    await page.getByRole('button', { name: /table/i }).click();
    const rows = page.locator('.table-wrap tbody tr');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i)).toContainText(/negotiation/i);
    }
  });
});
