import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, signIn } from './helpers';

const STAGES = ['All stages', 'Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];

function stageSelect(page: Page) {
  return page.getByRole('combobox', { name: 'Stage' });
}

async function openDeals(page: Page) {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await openFilterRail(page);
  await expect(page.locator('.table-wrap, .kanban-col').first()).toBeVisible({ timeout: 25000 });
  await expect(stageSelect(page)).toBeVisible();
}

async function activeText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const box = document.querySelector('[role="combobox"][aria-expanded="true"]');
    const id = box?.getAttribute('aria-activedescendant');
    if (id === null || id === undefined) return '';
    return document.getElementById(id)?.textContent?.trim() ?? '';
  });
}

test.describe('the select replacement honours the APG combobox contract', () => {
  test('closed: ArrowDown opens on the selected option and changes nothing', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    const before = (await box.textContent())?.trim();

    await box.focus();
    await page.keyboard.press('ArrowDown');

    await expect(box).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();
    expect(await activeText(page)).toBe('All stages');
    expect((await box.textContent())?.trim()).toBe(before);
  });

  test('arrowing moves visual focus only, and Enter is what commits', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await activeText(page)).toBe('Qualified');
    expect((await box.textContent())?.trim()).toBe('All stages');

    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('Qualified');
    await expect(box).toBeFocused();
    await box.click();
    await expect(page.getByRole('option', { selected: true })).toHaveText('Qualified');
    await page.keyboard.press('Escape');
  });

  test('Escape closes without committing and returns focus', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    expect(await activeText(page)).toBe('Lead');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('All stages');
    await expect(box).toBeFocused();
  });

  test('Tab commits and moves on, Alt+ArrowUp commits and stays', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await activeText(page)).toBe('Lost');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('Lost');
    await expect(box).not.toBeFocused();

    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Home');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('All stages');
    await expect(box).toBeFocused();
  });

  test('Home and End reach the first and last option', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await activeText(page)).toBe(STAGES[STAGES.length - 1]);
    await page.keyboard.press('Home');
    expect(await activeText(page)).toBe(STAGES[0]);
    await page.keyboard.press('PageDown');
    expect(await activeText(page)).toBe(STAGES[STAGES.length - 1]);
    await page.keyboard.press('PageUp');
    expect(await activeText(page)).toBe(STAGES[0]);
  });

  test('type-ahead: one character, an accumulated string, and a repeated character cycling', async ({
    page,
  }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('q');
    expect(await activeText(page)).toBe('Qualified');

    await page.waitForTimeout(600);
    await page.keyboard.press('l');
    await page.keyboard.press('o');
    expect(await activeText(page)).toBe('Lost');

    await page.waitForTimeout(600);
    await page.keyboard.press('l');
    expect(await activeText(page)).toBe('Lead');
    await page.keyboard.press('l');
    expect(await activeText(page)).toBe('Lost');
    await page.keyboard.press('l');
    expect(await activeText(page)).toBe('Lead');
  });

  test('the ARIA state is correct in both states and one option is selected', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await expect(box).toHaveAttribute('aria-haspopup', 'listbox');
    const listId = await box.getAttribute('aria-controls');
    expect(listId).not.toBeNull();

    await box.click();
    const list = page.locator(`[id="${listId ?? ''}"]`);
    await expect(list).toHaveAttribute('role', 'listbox');
    const options = page.getByRole('option');
    await expect(options).toHaveCount(STAGES.length);
    for (let i = 0; i < STAGES.length; i += 1) {
      await expect(options.nth(i)).toHaveText(STAGES[i] ?? '');
    }
    expect(await page.getByRole('option', { selected: true }).count()).toBe(1);
    await expect(page.getByRole('option', { selected: true })).toHaveText('All stages');
  });

  test('an outside click closes the popup and commits nothing', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.locator('h1').first().click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('All stages');
  });

  test('a click on an option commits it', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.click();
    await page.getByRole('option', { name: 'Won' }).click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('Won');
    await box.click();
    await expect(page.getByRole('option', { selected: true })).toHaveText('Won');
  });

  test('at 390px the popup stays inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await openDeals(page);
    const box = stageSelect(page);
    await box.click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    const rect = await list.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((rect?.x ?? 0) + (rect?.width ?? 0)).toBeLessThanOrEqual(390);
    expect((rect?.y ?? 0) + (rect?.height ?? 0)).toBeLessThanOrEqual(780);
  });

  test('a long option list scrolls inside a bounded popup', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await openFilterRail(page);
    await expect(page.locator('.table-wrap')).toBeVisible({ timeout: 25000 });
    const box = page.getByRole('combobox', { name: 'Company' });
    await expect(box).toBeVisible();
    await box.click();
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    const measured = await list.evaluate((el) => ({
      height: Math.round(el.getBoundingClientRect().height),
      scrollHeight: el.scrollHeight,
      options: el.querySelectorAll('[role="option"]').length,
      overflow: getComputedStyle(el).overflowY,
      inViewport: el.getBoundingClientRect().bottom <= window.innerHeight,
    }));
    expect(measured.options).toBeGreaterThan(20);
    expect(measured.height).toBeLessThanOrEqual(320);
    expect(measured.scrollHeight).toBeGreaterThan(measured.height);
    expect(measured.overflow).toBe('auto');
    expect(measured.inViewport).toBe(true);

    await page.keyboard.press('End');
    const scrolled = await list.evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
  });
});
