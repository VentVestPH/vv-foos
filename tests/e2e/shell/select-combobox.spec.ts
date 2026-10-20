import { expect, test, type Page } from '@playwright/test';
import { clientAs } from '../../support/env';
import { NEEDS_IMPORT, PERSONA_EMAILS, gotoAsSignedIn, hasImportedDataset, openFilterRail, optionNames, signIn } from '../../support/e2e-helpers';

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
    const box = document.querySelector('.field-select-search-input');
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
    await page.keyboard.press('PageDown');
    expect(await activeText(page)).toBe('Lost');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('Lost');
    await expect(box).not.toBeFocused();

    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageUp');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('All stages');
    await expect(box).toBeFocused();
  });

  test('PageDown and PageUp reach the last and first option', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('PageDown');
    expect(await activeText(page)).toBe(STAGES[STAGES.length - 1]);
    await page.keyboard.press('PageUp');
    expect(await activeText(page)).toBe(STAGES[0]);
  });

  test('focus moves into the search field when the popup opens', async ({ page }) => {
    await openDeals(page);
    await stageSelect(page).click();
    await expect(page.getByRole('searchbox', { name: 'Search Stage' })).toBeFocused();
  });

  test('typing filters the options, ignores case, and Enter commits the first match', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('ArrowDown');

    await page.keyboard.type('QUAL');
    await expect(page.getByRole('option')).toHaveText(['Qualified']);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('Qualified');
    await expect(box).toBeFocused();
  });

  test('a letter typed on the closed select opens it already filtered', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.focus();
    await page.keyboard.press('q');
    await expect(page.getByRole('searchbox', { name: 'Search Stage' })).toHaveValue('q');
    await expect(page.getByRole('option')).toHaveText(['Qualified']);
  });

  test('a search with no match says so and offers nothing to commit', async ({ page }) => {
    await openDeals(page);
    const box = stageSelect(page);
    await box.click();
    await page.getByRole('searchbox', { name: 'Search Stage' }).fill('zzzz');
    await expect(page.getByRole('option')).toHaveText(['No matches']);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(box).toContainText('All stages');
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
    test.skip(!(await hasImportedDataset()), NEEDS_IMPORT);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await openFilterRail(page);
    await expect(page.locator('.table-wrap')).toBeVisible({ timeout: 25000 });
    const box = page.getByRole('combobox', { name: 'Company' });
    await expect(box).toBeVisible();
    await expect
      .poll(async () => (await optionNames(page, box)).length, { timeout: 25000 })
      .toBeGreaterThan(20);
    await box.click();
    const list = page.locator('.field-select-menu');
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

    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    const scrolled = await list.evaluate((el) => el.scrollTop);
    expect(scrolled).toBeGreaterThan(0);
  });
});

const HOVER_RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const HOVER_COMPANY = `Hvco${HOVER_RUN}`;

test.describe('hover never scrolls an option list', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('companies').insert(
      Array.from({ length: 24 }, (_, i) => ({
        name: `${HOVER_COMPANY}-${String(i).padStart(2, '0')}`,
        is_test: true,
      })),
    );
    if (error) throw error;
  });

  test.afterAll(async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('companies').delete().like('name', `${HOVER_COMPANY}%`);
    if (error) throw new Error(`could not remove the hover fixture: ${error.message}`);
  });

  test('hovering an option never scrolls the list; only the keyboard does', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await openFilterRail(page);

  const box = page.getByRole('combobox', { name: 'Company' });
  await box.click();
  const menu = page.locator('.field-select-menu');
  await expect(menu).toBeVisible();
  expect(
    await menu.evaluate((el) => el.scrollHeight > el.clientHeight + 1),
    'the list has to overflow for hover-scrolling to be possible at all, so this seeds two dozen companies rather than skipping when the seed database only has five. It skipped on CI and therefore never ran where it mattered',
  ).toBe(true);

  const options = menu.locator('.field-select-option');
  const last = Math.min(await options.count(), 8) - 1;
  const before = await menu.evaluate((el) => el.scrollTop);

  for (let i = 0; i <= last; i += 1) {
    await options.nth(i).hover();
  }
  const box2 = await menu.boundingBox();
  await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + 2);
  await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + box2!.height - 2);

  expect(
    await menu.evaluate((el) => el.scrollTop),
    'the list scrolled itself under the cursor. Only the scrollbar, the wheel and a drag may scroll it',
  ).toBe(before);

  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect
    .poll(async () => menu.evaluate((el) => el.scrollTop), {
      timeout: 5000,
      message: 'the keyboard still has to bring its option into view, which the APG requires',
    })
    .toBeGreaterThan(before);
  });
  test('the search field stays pinned to the top of the popup while the options scroll', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await openFilterRail(page);
    await page.getByRole('combobox', { name: 'Company' }).click();
    const menu = page.locator('.field-select-menu');
    await expect(menu).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search Company' });
    const offset = async () =>
      Math.round((await search.boundingBox())!.y - (await menu.boundingBox())!.y);
    const before = await offset();

    await page.keyboard.press('PageDown');
    await page.keyboard.press('PageDown');
    await expect.poll(() => menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(search).toBeInViewport();
    expect(await offset()).toBe(before);
  });
});