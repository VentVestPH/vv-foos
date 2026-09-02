import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('Q3: one search across every entity', () => {
  test('the sidebar carries the typed keywords into the global search', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/sales/deals');

    await page.getByLabel('Deal keywords').fill('Manila');
    await page.getByRole('button', { name: 'Search everything' }).click();

    await expect(page).toHaveURL(/\/search\?q=Manila/);
    await expect(page.getByRole('heading', { name: 'Search everything' })).toBeVisible();
    await expect(page.getByLabel('Search everything')).toHaveValue('Manila');
  });

  test('a requisition code finds the requisition and nothing else', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    const firstRow = page.locator('.table-wrap tbody tr[data-row-key]').first();
    await expect(firstRow).toBeVisible({ timeout: 25000 });
    const rowText = (await firstRow.textContent()) ?? '';
    const code = (/REQ-\d+/.exec(rowText) ?? [''])[0];
    expect(code).toMatch(/^REQ-\d+$/);

    await gotoAsSignedIn(page, `/search?q=${code}`);
    const section = page
      .locator('.record-section')
      .filter({ hasText: /^[▸▾]?\s*Requisitions/ });
    await expect(section).toBeVisible({ timeout: 20000 });
    await expect(section.locator('.search-hit-list li')).toHaveCount(1);
    await expect(section.getByRole('link', { name: new RegExp(code) })).toBeVisible();
  });

  test('a candidate name reaches the candidate record', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const firstRow = page.locator('.table-wrap tbody tr[data-row-key]').first();
    await expect(firstRow).toBeVisible({ timeout: 25000 });
    const key = (await firstRow.getAttribute('data-row-key')) ?? '';
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    const cells = await firstRow.locator('td').allTextContents();
    const name = (cells.find((c) => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(c.trim())) ?? '').trim();
    expect(name.length, `no name-looking cell in ${JSON.stringify(cells)}`).toBeGreaterThan(1);
    const surname = name.split(/\s+/).pop() as string;

    await gotoAsSignedIn(page, `/search?q=${encodeURIComponent(surname)}`);
    const section = page
      .locator('.record-section')
      .filter({ hasText: /^[▸▾]?\s*Candidates/ });
    await expect(section).toBeVisible({ timeout: 20000 });
    await section.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
  });

  test('a search with no match says so instead of showing empty sections', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/search?q=zzqqxx-no-such-record');
    await expect(page.getByText('Searching…')).toBeHidden({ timeout: 25000 });
    await expect(page.locator('.table-empty')).toContainText('Nothing matches', { timeout: 25000 });
    await expect(page.locator('.record-section')).toHaveCount(0);
  });

  test('a single character is refused rather than scanning every table', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/search?q=a');
    await expect(page.getByText('Type at least two characters.')).toBeVisible();
    await expect(page.locator('.record-section')).toHaveCount(0);
  });

  test('a sourcer sees only the candidates RLS allows them', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/search?q=an');
    await expect(page.getByRole('heading', { name: 'Search everything' })).toBeVisible();
    await expect(page.locator('.record-section').filter({ hasText: 'Deals' })).toHaveCount(0);
  });
});
