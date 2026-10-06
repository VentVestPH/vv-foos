import { expect, test, type Page } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const TAG = `zzdeal${process.pid}${Math.random().toString(36).slice(2, 8)}`;
const DOOMED = `${TAG} doomed deal`;
const KEPT = `${TAG} kept deal`;

let doomedId = '';
let keptId = '';

test.describe.configure({ mode: 'serial' });

async function toTable(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Table' }).click();
  await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 25000 });
}

async function findTagged(page: Page, expected: number): Promise<void> {
  const box = page.getByRole('searchbox', { name: 'Search Deals' });
  await box.fill(TAG);
  await box.press('Enter');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]')).toHaveCount(expected, {
    timeout: 25000,
  });
}

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('deals')
    .insert([
      { name: DOOMED, stage: 'lead', is_test: true },
      { name: KEPT, stage: 'qualified', is_test: true },
    ])
    .select('id, name');
  if (error) throw error;
  doomedId = (data ?? []).find((d) => d.name === DOOMED)?.id ?? '';
  keptId = (data ?? []).find((d) => d.name === KEPT)?.id ?? '';
  expect(doomedId, 'the doomed fixture deal must insert').not.toBe('');
  expect(keptId, 'the kept fixture deal must insert').not.toBe('');
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('ats_saved_views').delete().like('name', `${TAG}%`);
  await admin.from('deals').delete().like('name', `${TAG}%`);
});

test('D1: the view switch is the shared segmented control, not a bespoke one', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');

  const toggle = page.locator('.fo-segmented');
  await expect(toggle, 'deals uses the same control as the requisition pipeline').toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Table' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Kanban' })).toBeVisible();
  expect(
    await toggle.evaluate((el) => Math.round(el.getBoundingClientRect().height)),
    'the switch is one control height, not the 34px a padded 28px button produced',
  ).toBe(32);
  await expect(page.locator('.sales-view-toggle'), 'the bespoke toggle is gone').toHaveCount(0);
});

test('D1b: the saved view opens with matching content and the first stage meets the page edge', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await page.evaluate(() => window.localStorage.setItem('foos.deals.view', 'table'));
  await gotoAsSignedIn(page, '/sales/deals');
  await expect(page.getByRole('tab', { name: 'Table' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 25000 });

  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page.locator('.sales-deals-board .kanban-col').first()).toBeVisible({ timeout: 25000 });
  const [boardLeft, firstColumnLeft] = await Promise.all([
    page.locator('.sales-deals-board').evaluate((element) => element.getBoundingClientRect().left),
    page.locator('.sales-deals-board .kanban-col').first().evaluate((element) => element.getBoundingClientRect().left),
  ]);
  expect(Math.abs(firstColumnLeft - boardLeft)).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('foos.deals.view'))).toBe('kanban');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Kanban' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.sales-deals-board .kanban-col').first()).toBeVisible({ timeout: 25000 });
});

test('D2: the checkbox leads the table and Delete does not exist until a row is ticked', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await toTable(page);
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });

  const first = page.locator('.table-wrap thead th').first();
  expect(
    await first.evaluate((el) => el.className),
    'the selection column leads the row, as on accounts and intake',
  ).toContain('checkbox-col');

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
});

test('D3: unticking decays the bar rather than dropping the button out of it', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await toTable(page);
  const row = page.locator('.table-wrap tbody tr[data-row-key]').first();
  await expect(row).toBeVisible({ timeout: 25000 });

  const grow = page.locator('.fo-page-head-grow');
  await row.getByRole('checkbox').check();
  await expect(grow).toHaveAttribute('data-open', 'true');

  await row.getByRole('checkbox').uncheck();
  await expect(grow).toHaveAttribute('data-open', 'false');
  await expect(
    page.locator('.fo-list-action-bar .btn-danger'),
    'the button stays in the DOM so the bar collapses around it instead of emptying first',
  ).toHaveCount(1);
  await expect(
    grow,
    'and a closed bar is out of the accessibility tree, so a keyboard cannot reach it',
  ).toHaveAttribute('aria-hidden', 'true');
  expect(
    await grow.evaluate((el) => getComputedStyle(el).transitionProperty),
    'the bar decays rather than vanishing, which is what the transition declares',
  ).toContain('grid-template-rows');
});

test('D4: the search suggests without filtering, and Enter is what filters', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await toTable(page);
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  const unfiltered = await rows.count();

  const box = page.getByRole('searchbox', { name: 'Search Deals' });
  await box.pressSequentially(TAG, { delay: 60 });
  await expect(
    page.locator('.fo-hint-pop'),
    'three characters or more suggests while typing',
  ).toBeVisible({ timeout: 25000 });
  expect(
    await rows.count(),
    'typing must not filter the table, however long the user pauses',
  ).toBe(unfiltered);

  await box.press('Enter');
  await expect(rows).toHaveCount(2, { timeout: 25000 });
});

test('D5: column settings hides a table column, stage settings hides a kanban column', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await toTable(page);
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });

  await page.getByRole('button', { name: 'Column settings' }).click();
  const columnDialog = page.getByRole('dialog', { name: 'Column settings' });
  await expect(columnDialog).toBeVisible({ timeout: 25000 });
  await columnDialog.getByRole('checkbox', { name: 'Prob.' }).uncheck();
  await columnDialog.getByRole('button', { name: 'Done' }).click();
  await expect(columnDialog).toHaveCount(0, { timeout: 25000 });
  await expect(page.locator('.table-wrap thead')).not.toContainText('Prob.');

  await page.getByRole('tab', { name: 'Kanban' }).click();
  await expect(page.locator('.kanban-col').first()).toBeVisible({ timeout: 25000 });
  const before = await page.locator('.kanban-col').count();

  await page.getByRole('button', { name: 'Stage settings' }).click();
  const stageDialog = page.getByRole('dialog', { name: 'Stage settings' });
  await expect(stageDialog).toBeVisible({ timeout: 25000 });
  await stageDialog.getByRole('checkbox', { name: 'Lost' }).uncheck();
  await stageDialog.getByRole('button', { name: 'Done' }).click();
  await expect(stageDialog).toHaveCount(0, { timeout: 25000 });
  await expect(
    page.locator('.kanban-col'),
    'the board settings pick the stage columns, which is what a kanban has instead of headers',
  ).toHaveCount(before - 1);
});

test('D6: the record carries its company and contact under the title, not at the foot', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals/e0000000-0000-4000-8000-000000000010');
  await expect(page.locator('.record-action-bar')).toBeVisible({ timeout: 25000 });

  const links = page.locator('.fo-page-head .sales-record-links .link-btn');
  await expect(
    links,
    'the company and the primary contact sit in the head, where CRM record pages put them',
  ).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Open primary contact record' }),
    'and no longer at the bottom of the page',
  ).toHaveCount(0);
});

test('D7: Edit writes every field it offers, including the ones only a lost deal shows', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/sales/deals/${keptId}`);
  await expect(page.locator('.record-action-bar')).toBeVisible({ timeout: 25000 });

  await page.locator('.record-action-bar').getByRole('button', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit deal' });
  await expect(dialog).toBeVisible({ timeout: 25000 });

  await dialog.getByLabel('Value', { exact: true }).fill('123456');
  await dialog.getByLabel('Probability (%)', { exact: true }).fill('45');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog).toHaveCount(0, { timeout: 25000 });

  const admin = await clientAs('admin');
  const { data } = await admin
    .from('deals')
    .select('value, probability')
    .eq('id', keptId)
    .single();
  expect(data?.value, 'the dialog has to write deals, not just close').toBe(123456);
  expect(data?.probability).toBe(45);
});

test('D8: deleting a deal names what goes with it and removes only that row', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await toTable(page);
  await findTagged(page, 2);

  const doomedRow = page.locator('.table-wrap tbody tr[data-row-key]').filter({ hasText: DOOMED });
  await doomedRow.getByRole('checkbox').check();
  await page
    .locator('.fo-list-action-bar')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Delete deal' });
  await expect(dialog).toContainText(DOOMED);
  await dialog.getByRole('button', { name: /Delete permanently/ }).click();
  await expect(dialog).toHaveCount(0, { timeout: 25000 });
  await expect(page.locator('.fo-bulk-notice')).toContainText('1 deal deleted.');

  const admin = await clientAs('admin');
  const { data } = await admin.from('deals').select('id').like('name', `${TAG}%`);
  expect(
    (data ?? []).map((d) => d.id),
    'only the ticked deal goes; the other fixture survives',
  ).toEqual([keptId]);
});
