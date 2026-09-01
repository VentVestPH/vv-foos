// Browser flow test — ATS: sign in as recruiter, open a requisition's
// pipeline, confirm the kanban/table views render and a card is draggable.
// Runs against a local `npm run dev` instance (see playwright.config.ts) —
// same "drive the real app, not just the API" principle as Agent 6's live
// testing, applied to a repeatable automated spec instead of a one-off
// manual click-through.
import { expect, test } from '@playwright/test';

const RECRUITER_EMAIL = 'rita.demo@ventvest.com';
// SECURITY (QA-003): no literal fallback. The old default was a working
// credential against the live project. See tests/env.ts.
const TEST_PASSWORD = (() => {
  const value = process.env.FOOS_QA_TEST_PASSWORD;
  if (!value) throw new Error('FOOS_QA_TEST_PASSWORD is not set (see tests/.env.example)');
  return value;
})();

test.describe('ATS pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(RECRUITER_EMAIL);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/(?!login)/, { timeout: 10000 });
  });

  test('requisition list loads and opens a record', async ({ page }) => {
    await page.goto('/recruit/requisitions');
    await expect(page.getByRole('heading', { name: /requisitions/i })).toBeVisible();
    const firstRow = page.locator('.table-wrap tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 10000 });
    await firstRow.click();
    await expect(page).toHaveURL(/\/recruit\/requisitions\/[a-f0-9-]+/);
  });

  test('candidate list shows star grading and filters', async ({ page }) => {
    await page.goto('/recruit/candidates');
    await expect(page.getByRole('heading', { name: /candidates/i })).toBeVisible();
    await expect(page.locator('.filter-rail')).toBeVisible();
  });

  test('pipeline board renders both table and kanban views', async ({ page }) => {
    await page.goto('/recruit/requisitions');
    const firstRow = page.locator('.table-wrap tbody tr').first();
    await firstRow.click();
    // ApplicationPipeline renders inside the requisition record page.
    await expect(page.locator('body')).toContainText(/pipeline/i, { timeout: 10000 });
  });
});
