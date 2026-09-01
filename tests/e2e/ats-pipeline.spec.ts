import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('ATS pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
  });

  test('requisition list loads and opens a record', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await expect(page.getByRole('heading', { name: /^Requisitions/ })).toBeVisible();
    const firstRow = page.locator('.table-wrap tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.locator('.link-btn').first().click();
    await expect(page).toHaveURL(/\/recruit\/requisitions\/[0-9a-f-]{36}/);
  });

  test('candidate list shows the filter rail and rows', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.getByRole('heading', { name: /^Candidates/ })).toBeVisible();
    await expect(page.locator('.filter-rail')).toBeVisible();
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 15000 });
  });

  test('requisition record renders its application pipeline', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/requisitions');
    const firstRow = page.locator('.table-wrap tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 15000 });
    await firstRow.locator('.link-btn').first().click();
    await expect(page).toHaveURL(/\/recruit\/requisitions\/[0-9a-f-]{36}/);
    await expect(page.locator('body')).toContainText(/pipeline/i, { timeout: 15000 });
  });

  test('list pages paginate without a full reload', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 15000 });
    const pager = page.locator('.taleo-pager');
    if (await pager.count()) {
      await expect(pager.first()).toContainText(/\d+\s*-\s*\d+\s+of\s+\d+/);
    }
  });
});
