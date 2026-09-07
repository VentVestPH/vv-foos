import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

async function openCandidates(page: Page) {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  return rows;
}

function activeKey(page: Page) {
  return page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.closest('tr')?.getAttribute('data-row-key'),
  );
}

function neighbourOfActive(page: Page, offset: number) {
  return page.evaluate((step: number) => {
    const active = (document.activeElement as HTMLElement | null)?.closest('tr');
    if (!active) return null;
    const all = Array.from(document.querySelectorAll('.table-wrap tbody tr[data-row-key]'));
    const at = all.indexOf(active);
    if (at < 0) return null;
    const next = all[at + step];
    return next ? next.getAttribute('data-row-key') : null;
  }, offset);
}

test.describe('Q6: the lists are usable from the keyboard', () => {
  test('slash focuses the list search from anywhere on the page', async ({ page }) => {
    await openCandidates(page);
    await page.locator('h1').first().click();
    await page.keyboard.press('/');

    const search = page.getByLabel('Search Candidates');
    await expect(search).toBeFocused();
    await page.keyboard.type('abc');
    await expect(search).toHaveValue('abc');
  });

  test('slash inside a text field types a slash instead of stealing focus', async ({ page }) => {
    await openCandidates(page);
    const search = page.getByLabel('Search Candidates');
    await search.click();
    await page.keyboard.type('a/b');
    await expect(search).toHaveValue('a/b');
  });

  test('j and k walk the rows, Enter opens the record', async ({ page }) => {
    const rows = await openCandidates(page);
    await rows.nth(0).focus();
    const startKey = await activeKey(page);
    expect(startKey).not.toBeNull();

    const expectedAfterJ = await neighbourOfActive(page, 1);
    await page.keyboard.press('j');
    expect(await activeKey(page)).toBe(expectedAfterJ);

    const expectedAfterK = await neighbourOfActive(page, -1);
    await page.keyboard.press('k');
    expect(await activeKey(page)).toBe(expectedAfterK);

    const expectedAfterDown = await neighbourOfActive(page, 1);
    await page.keyboard.press('ArrowDown');
    const landedOn = await activeKey(page);
    expect(landedOn).toBe(expectedAfterDown);

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/recruit/candidates/${landedOn ?? ''}`));
  });

  test('End and Home jump to the last and first row', async ({ page }) => {
    const rows = await openCandidates(page);
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
    const last = await rows.nth(count - 1).getAttribute('data-row-key');
    const first = await rows.nth(0).getAttribute('data-row-key');

    await rows.nth(0).focus();
    await page.keyboard.press('End');
    expect(await activeKey(page)).toBe(last);
    await page.keyboard.press('Home');
    expect(await activeKey(page)).toBe(first);
  });

  test('space selects the focused row without scrolling the page', async ({ page }) => {
    const rows = await openCandidates(page);
    const key = await rows.nth(0).getAttribute('data-row-key');
    await rows.nth(0).focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.keyboard.press(' ');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`),
    ).toBeChecked();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    await page.keyboard.press('x');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  test('only one row is in the tab order, so the table is one tab stop', async ({ page }) => {
    const rows = await openCandidates(page);
    const tabbable = await page.locator('.table-wrap tbody tr[tabindex="0"]').count();
    expect(tabbable).toBe(1);
    expect(await rows.count()).toBeGreaterThan(1);
  });
});
