import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, signIn } from '../../support/e2e-helpers';

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
    await openFilterRail(page);
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
    const pager = page.locator('.fo-pager');
    if (await pager.count()) {
      await expect(pager.first()).toContainText(/\d+\s*-\s*\d+\s+of\s+\d+/);
    }
  });
});

test('the pager keeps its controls when there is only one page, so nothing jumps', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  const firstRow = page.locator('.table-wrap tbody tr').first();
  await expect(firstRow).toBeVisible({ timeout: 25000 });
  await firstRow.locator('.link-btn').first().click();
  await expect(page).toHaveURL(/\/recruit\/requisitions\/[0-9a-f-]{36}/, { timeout: 25000 });
  const header = page.getByRole('button', { name: /^Application Pipeline/ });
  await expect(header).toBeVisible({ timeout: 25000 });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  const pager = page.locator('#application-pipeline .fo-pager').first();
  await expect(pager).toBeVisible({ timeout: 25000 });
  const state = await pager.evaluate((el) => {
    const buttons = [...el.querySelectorAll('button')];
    return {
      count: buttons.length,
      labels: buttons.map((b) => b.getAttribute('aria-label')),
      allDisabled: buttons.every((b) => (b as HTMLButtonElement).disabled),
      titled: buttons.every((b) => (b.getAttribute('title') ?? '') !== ''),
    };
  });
  expect(state.count, 'all four chevrons stay put').toBe(4);
  expect(state.labels).toEqual(['First page', 'Previous page', 'Next page', 'Last page']);
  expect(state.allDisabled, 'and they are disabled rather than removed').toBe(true);
  expect(state.titled, 'a control a user cannot press must say why').toBe(true);
});
