import { expect, test, type Page } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, signIn } from './helpers';

const TAG = `zzacct${process.pid}${Math.random().toString(36).slice(2, 8)}`;
const LONE = `${TAG} lone account`;
const HELD = `${TAG} held account`;

let loneId = '';
let heldId = '';

test.describe.configure({ mode: 'serial' });

async function headerTexts(page: Page): Promise<string[]> {
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });
  return page.evaluate(() =>
    [...document.querySelectorAll('.table-wrap thead th')]
      .map((th) => (th.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter((text) => text !== ''),
  );
}

async function findTagged(page: Page): Promise<void> {
  const box = page.getByRole('searchbox', { name: 'Search Accounts' });
  await box.fill(TAG);
  await box.press('Enter');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]')).toHaveCount(2, {
    timeout: 25000,
  });
}

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('companies')
    .insert([
      { name: LONE, types: ['prospect'], is_test: true },
      { name: HELD, types: ['prospect'], is_test: true },
    ])
    .select('id, name');
  if (error) throw error;
  loneId = (data ?? []).find((c) => c.name === LONE)?.id ?? '';
  heldId = (data ?? []).find((c) => c.name === HELD)?.id ?? '';
  expect(loneId, 'the lone fixture account must insert').not.toBe('');
  expect(heldId, 'the held fixture account must insert').not.toBe('');

  const { error: dealErr } = await admin
    .from('deals')
    .insert({ name: `${TAG} blocking deal`, company_id: heldId, is_test: true });
  if (dealErr) throw dealErr;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('ats_saved_views').delete().like('name', `${TAG}%`);
  await admin.from('deals').delete().like('name', `${TAG}%`);
  await admin.from('companies').delete().like('name', `${TAG}%`);
});

test('A1: the checkbox is the first column, before the ID', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });

  const first = page.locator('.table-wrap thead th').first();
  expect(
    await first.evaluate((el) => el.className),
    'the selection column has to lead the row, as it does on requisitions and candidates',
  ).toContain('checkbox-col');
  await expect(first.getByRole('checkbox', { name: /Select all/ })).toHaveCount(1);
});

test('A2: Delete does not exist until a row is ticked, then the bar grows open', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });

  const grow = page.locator('.fo-page-head-grow');
  await expect(grow).toHaveAttribute('data-open', 'false');
  expect(
    await grow.evaluate((el) => el.getBoundingClientRect().height),
    'a closed bulk bar occupies no height, so Delete is not on screen',
  ).toBe(0);

  await page.locator('.table-wrap tbody tr[data-row-key]').first().getByRole('checkbox').check();

  await expect(grow).toHaveAttribute('data-open', 'true');
  const bar = page.locator('.fo-list-action-bar');
  await expect(bar.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  await expect(bar).toContainText('1 selected.');

  expect(
    await grow.evaluate((el) => getComputedStyle(el).transitionProperty),
    'the bar grows and decays rather than appearing, which is what the transition declares',
  ).toContain('grid-template-rows');
});

test('A3: typing suggests accounts and nothing else, and does not filter the table', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  const unfiltered = await rows.count();

  await page.getByRole('searchbox', { name: 'Search Accounts' }).fill(TAG);

  const hints = page.locator('.fo-hint-pop a.fo-hint');
  await expect(hints.first()).toBeVisible({ timeout: 25000 });
  const hrefs = await hints.evaluateAll((els) =>
    els.map((el) => el.getAttribute('href') ?? ''),
  );
  expect(hrefs.length, 'the fixtures are named to be the only match for this tag').toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, 'an account search may only suggest accounts').toMatch(/^\/sales\/companies\//);
  }

  expect(
    await rows.count(),
    'the table only changes when the search is submitted, never while typing',
  ).toBe(unfiltered);
});

test('A4: submitting the search narrows the table to the fixtures', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  await findTagged(page);
  await expect(page.locator('.table-wrap tbody')).toContainText(LONE);
  await expect(page.locator('.table-wrap tbody')).toContainText(HELD);
});

test('A5: column settings drops a column from the table', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  expect(await headerTexts(page)).toContain('Website');

  await page.getByRole('button', { name: 'Column settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Column settings' });
  await dialog.getByRole('checkbox', { name: 'Website' }).uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();

  expect(
    await headerTexts(page),
    'unticking a column has to remove it from the table, not only from the dialog',
  ).not.toContain('Website');
});

test('A6: a shared view keeps the column choice, in the database, for everyone', async ({
  page,
}) => {
  const viewName = `${TAG} shared`;
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });

  await page.getByRole('button', { name: 'Column settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Column settings' });
  await settings.getByRole('checkbox', { name: 'Phone' }).uncheck();
  await settings.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  const save = page.getByRole('dialog', { name: 'Save view' });
  await save.getByLabel('View name').fill(viewName);
  await save.getByRole('checkbox', { name: /Share with the team/ }).check();
  await save.getByRole('button', { name: 'Save' }).click();
  await expect(save).toHaveCount(0, { timeout: 25000 });

  const admin = await clientAs('admin');
  const { data } = await admin
    .from('ats_saved_views')
    .select('entity, is_shared, columns')
    .eq('name', viewName)
    .single();
  expect(data?.entity, 'an account view is stored under its own entity').toBe('company');
  expect(data?.is_shared, 'the share tick has to reach the row other people read').toBe(true);
  expect(
    data?.columns as string[],
    'the view records the columns that were showing, so applying it reproduces them',
  ).not.toContain('phone');

  await page.reload();
  expect(
    await headerTexts(page),
    'a reload starts from the default columns, which is what makes the view worth applying',
  ).toContain('Phone');

  await chooseOption(page, page.getByRole('combobox', { name: 'Saved views' }), `${viewName} (shared)`);
  expect(await headerTexts(page), 'applying the view puts its column choice back').not.toContain(
    'Phone',
  );
});

test('A7: delete removes an unreferenced account and keeps one that still has records', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies');
  await findTagged(page);

  await page.locator('.table-wrap thead input[type="checkbox"]').check();
  await page.locator('.fo-list-action-bar').getByRole('button', { name: 'Delete', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: /Delete 2 accounts/ });
  await expect(dialog).toContainText(LONE);
  await expect(dialog, 'the held account is named with what is holding it').toContainText('1 deal');

  await dialog.getByRole('button', { name: /Delete 1 permanently|Delete permanently/ }).click();
  await expect(dialog).toHaveCount(0, { timeout: 25000 });
  await expect(page.getByRole('status')).toContainText('1 account deleted.');

  const admin = await clientAs('admin');
  const { data } = await admin.from('companies').select('id').like('name', `${TAG}%`);
  expect(
    (data ?? []).map((r) => r.id),
    'only the account nothing pointed at is gone; a cascade would have taken the deal too',
  ).toEqual([heldId]);

  const { data: deals } = await admin.from('deals').select('id').like('name', `${TAG}%`);
  expect((deals ?? []).length, 'the blocking deal survives untouched').toBe(1);
});
