import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const SEEDED_REQUISITION = 'd0000000-0000-4000-8000-000000000001';
const PREF_KEYS = ['ui.sections.recruit.requisition.record', 'ui.sections.dashboard.pipeline'];

test.afterAll(async () => {
  const client = await clientAs('admin');
  await client.from('integration_settings').delete().in('key', PREF_KEYS);
});

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

async function headers(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.table-wrap thead th')]
      .map((th) => (th.textContent ?? '').trim())
      .filter((text) => text !== ''),
  );
}

test('V1: the column gear reorders columns with the keyboard and hides one', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
  const before = await headers(page);

  const gear = page.getByRole('button', { name: 'Column settings' });
  await expect(gear, 'the gear must be a plain icon button').toBeVisible();
  expect(
    await gear.evaluate((el) => getComputedStyle(el).borderTopWidth),
    'the settings gear carries no border',
  ).toBe('0px');
  await gear.click();

  const rows = page.locator('.fo-column-row');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator('.fo-column-row .fo-icon-btn'),
    'reordering is a drag, not a pair of chevrons',
  ).toHaveCount(0);
  expect(
    await rows.first().locator('.fo-column-grip').evaluate((el) => getComputedStyle(el).touchAction),
    'the grip must claim the gesture so touch dragging works',
  ).toBe('none');

  const second = (await rows.nth(1).innerText()).trim();
  await rows.nth(1).locator('.fo-column-grip').focus();
  await page.keyboard.press('ArrowUp');
  await expect(rows.first()).toContainText(second);

  const lastName = (await rows.last().innerText()).trim();
  await rows.last().getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: 'Done' }).click();

  const after = await headers(page);
  expect(after, 'the hidden column is gone from the table').not.toContain(lastName);
  expect(after.length, 'exactly one column left').toBe(before.length - 1);
  expect(after[0], 'and the reorder reached the table').toBe(second);

  await page.getByRole('button', { name: 'Column settings' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  expect(await headers(page), 'Reset puts every column back in its original place').toEqual(before);
});

test('V2: the section gear hides an accordion and remembers it', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  const before = await page.locator('.record-section').count();

  await page.getByRole('button', { name: 'Section settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Section settings' });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('checkbox', { name: 'Approvals:', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByRole('button', { name: /^Approvals/ })).toHaveCount(0);
  expect(await page.locator('.record-section').count()).toBe(before - 1);

  await page.reload();
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  await expect(
    page.getByRole('button', { name: /^Approvals/ }),
    'the choice must survive a reload',
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Section settings' }).click();
  const reopened = page.getByRole('dialog', { name: 'Section settings' });
  await reopened.getByRole('button', { name: 'Show all' }).click();
  await reopened.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Approvals/ })).toBeVisible();
});

test('V3: a section can be told to open on page load', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  const tasks = page.getByRole('button', { name: /^Tasks/ }).first();
  await expect(tasks).toBeVisible({ timeout: 25000 });
  expect(await tasks.getAttribute('aria-expanded'), 'Tasks starts closed').toBe('false');

  await page.getByRole('button', { name: 'Section settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Section settings' });
  const row = dialog.locator('.fo-section-row', { hasText: 'Tasks' }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  const box = row.getByRole('checkbox', { name: /Open Tasks on page load/ });
  expect(
    await box.evaluate((el) => {
      const cell = el.closest('.fo-section-row-open')!.getBoundingClientRect();
      const own = el.getBoundingClientRect();
      return Math.round(own.left + own.width / 2 - (cell.left + cell.width / 2));
    }),
    'the open-on-load box is centred in its column',
  ).toBe(0);
  await box.check();
  await dialog.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  const reloaded = page.getByRole('button', { name: /^Tasks/ }).first();
  await expect(reloaded).toBeVisible({ timeout: 25000 });
  await expect
    .poll(async () => reloaded.getAttribute('aria-expanded'), {
      timeout: 15000,
      message: 'Tasks must open on load once asked to',
    })
    .toBe('true');

  await page.getByRole('button', { name: 'Section settings' }).click();
  await page
    .getByRole('dialog', { name: 'Section settings' })
    .getByRole('checkbox', { name: /Open Tasks on page load/ })
    .uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
});

test('V4: hiding a section disables its open-on-load box, with a reason', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: 'Section settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Section settings' });
  const row = dialog.locator('.fo-section-row', { hasText: 'Comments' }).first();
  await row.getByRole('checkbox', { name: 'Comments', exact: true }).uncheck();

  const box = row.getByRole('checkbox', { name: /Open Comments on page load/ });
  await expect(box, 'a hidden section cannot also open on load').toBeDisabled();
  await expect(box, 'and it says why').toHaveAttribute('title', 'Show the section first');

  await dialog.getByRole('button', { name: 'Show all' }).click();
  await expect(box).toBeEnabled();
  await dialog.getByRole('button', { name: 'Done' }).click();
});

test('V5: the pipeline dashboard has its own section settings', async ({ page }) => {
  test.setTimeout(120000);
  await gotoAsSignedIn(page, '/pipeline');
  await expect(page.locator('.dash-widgets-panel')).toBeVisible({ timeout: 25000 });
  const gear = page.getByRole('button', { name: 'Pipeline settings' });
  await expect(gear).toBeVisible();
  await gear.click();
  const dialog = page.getByRole('dialog', { name: 'Pipeline settings' });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await dialog.getByRole('checkbox', { name: 'Requisition Aging', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Requisition Aging/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Pipeline settings' }).click();
  const reopened = page.getByRole('dialog', { name: 'Pipeline settings' });
  await reopened.getByRole('button', { name: 'Show all' }).click();
  await reopened.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Requisition Aging/ })).toBeVisible();
});
