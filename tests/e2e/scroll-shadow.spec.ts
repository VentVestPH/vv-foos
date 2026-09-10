import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const SEEDED_REQUISITION = 'd0000000-0000-4000-8000-000000000001';
const PREF_KEYS = ['ui.sections.recruit.requisition.record'];

test.afterAll(async () => {
  const client = await clientAs('admin');
  await client.from('integration_settings').delete().in('key', PREF_KEYS);
});

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

async function edges(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    const cs = getComputedStyle(el);
    return {
      scrollable: el.scrollHeight - el.clientHeight > 1,
      top: el.dataset.shadowTop ?? null,
      bottom: el.dataset.shadowBottom ?? null,
      topOpacity: getComputedStyle(el, '::before').opacity,
      bottomOpacity: getComputedStyle(el, '::after').opacity,
      paddingBlock: `${cs.paddingTop}/${cs.paddingBottom}`,
      overflowX: cs.overflowX,
      sidewaysScroll: el.scrollWidth - el.clientWidth,
    };
  }, selector);
}

async function scrollTo(page: Page, selector: string, where: 'top' | 'middle' | 'bottom') {
  await page.locator(selector).evaluate((el, target) => {
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = target === 'top' ? 0 : target === 'bottom' ? max : Math.round(max / 2);
  }, where);
  await page.waitForTimeout(250);
}

async function assertFadeContract(page: Page, selector: string, label: string) {
  const rest = await edges(page, selector);
  expect(rest.scrollable, `${label} must overflow for the fade to mean anything`).toBe(true);
  expect(
    rest.paddingBlock,
    `${label} must carry no vertical padding, or the fade cannot reach the border`,
  ).toBe('0px/0px');
  expect(rest.overflowX, `${label} must not offer a sideways scrollbar`).toBe('hidden');
  expect(rest.sidewaysScroll, `${label} must not scroll sideways`).toBe(0);
  expect(`${rest.top}/${rest.bottom}`, `${label} at rest shows only the bottom fade`).toBe(
    'false/true',
  );
  expect(rest.topOpacity, `${label} hides the top fade at rest`).toBe('0');

  await scrollTo(page, selector, 'middle');
  const mid = await edges(page, selector);
  expect(`${mid.top}/${mid.bottom}`, `${label} mid-scroll fades both ends`).toBe('true/true');
  expect(`${mid.topOpacity}/${mid.bottomOpacity}`, `${label} paints both fades`).toBe('1/1');

  await scrollTo(page, selector, 'bottom');
  const end = await edges(page, selector);
  expect(`${end.top}/${end.bottom}`, `${label} at the end shows only the top fade`).toBe(
    'true/false',
  );
  expect(end.bottomOpacity, `${label} hides the bottom fade at the end`).toBe('0');
}

test('S1: a long dropdown fades at whichever end has more to show', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Advanced Search', disabled: false }).first().click();
  const company = page.locator('.filter-rail').getByRole('combobox', { name: /Company/i }).first();
  await expect(company).toBeVisible({ timeout: 15000 });
  await company.click();
  await expect(page.locator('.field-select-menu')).toBeVisible();
  await assertFadeContract(page, '.field-select-menu', 'the company listbox');
});

test('S2: a scrolling settings list fades at both ends, from the border', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Section settings' }).click();
  await expect(page.locator('.checkbox-list')).toBeVisible({ timeout: 15000 });
  await assertFadeContract(page, '.checkbox-list', 'the section settings list');
  await page.getByRole('button', { name: 'Done' }).click();
});

test('S3: a menu with nothing to scroll shows no fade at all', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  const trigger = page.locator('.record-action-bar .fo-action-menu-trigger').first();
  await expect(trigger).toBeVisible({ timeout: 25000 });
  await trigger.click();
  const menu = await edges(page, '.fo-action-menu');
  expect(menu.scrollable, 'a three-item menu does not scroll').toBe(false);
  expect(`${menu.top}/${menu.bottom}`, 'so neither end claims a fade').toBe('false/false');
  expect(`${menu.topOpacity}/${menu.bottomOpacity}`, 'and neither fade paints').toBe('0/0');
});

test('S4: the fade never steals the dropdown positioning it sits on', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  const trigger = page.locator('.record-action-bar .fo-action-menu-trigger').first();
  await expect(trigger).toBeVisible({ timeout: 25000 });
  await trigger.click();
  const placed = await page.evaluate(() => {
    const el = document.querySelector('.fo-action-menu') as HTMLElement;
    const wrap = el.parentElement!.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return {
      position: getComputedStyle(el).position,
      belowTrigger: Math.round(box.top - wrap.bottom),
    };
  });
  expect(placed.position, 'the menu must float over the page, not sit in the flow').toBe(
    'absolute',
  );
  expect(placed.belowTrigger, 'and it must drop below its trigger').toBeGreaterThanOrEqual(0);
});
