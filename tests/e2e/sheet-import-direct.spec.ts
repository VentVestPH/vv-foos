import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, signIn } from './helpers';

const RUN = `${process.pid}${Math.random().toString(36).slice(2, 8)}`;
const NEW_ACCOUNT = `QA Import Account ${RUN}`;

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('companies').delete().eq('name', NEW_ACCOUNT);
});

async function pick(page: import('@playwright/test').Page, label: string | RegExp, option: string): Promise<void> {
  await chooseOption(page, page.getByRole('combobox', { name: label }), option);
}

async function mockSheet(page: import('@playwright/test').Page, rows: Record<string, string>[]) {
  await page.route('**/functions/v1/intake-sheet-fetch', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ columns: Object.keys(rows[0] ?? {}), rows, suggestedTemplateHint: '' }),
    });
  });
}

test('FOOS-8: an account import previews new and existing rows, then creates only the new ones', async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page, PERSONA_EMAILS.admin);
  await mockSheet(page, [
    { 'Company': NEW_ACCOUNT, 'Kind': 'client', 'Phone number': '+63 2 8123 4567' },
    { 'Company': 'Aster Analytics', 'Kind': 'client', 'Phone number': '' },
  ]);
  await gotoAsSignedIn(page, '/intake/sheet');
  await pick(page, /^Target/, 'Account (imports directly)');
  await page.getByLabel(/Sheet URL/).fill('https://docs.google.com/spreadsheets/d/qa-import');
  await page.getByRole('button', { name: 'Fetch' }).click();

  await page.getByRole('button', { name: 'Continue to preview' }).click();
  await expect(page.getByText('Map a column to Account name; it is required.')).toBeVisible();

  await pick(page, /^Account name/, 'Company');
  await pick(page, /^Type/, 'Kind');
  await pick(page, /^Phone/, 'Phone number');
  await page.getByRole('button', { name: 'Continue to preview' }).click();

  const preview = page.locator('.table-wrap tbody');
  await expect(preview).toContainText('Will be imported');
  await expect(preview).toContainText('Skipped: An account with this name already exists');
  await page.getByRole('button', { name: 'Import 1 account' }).click();
  await expect(page.getByText('1 account imported, 1 skipped because they already exist.')).toBeVisible({ timeout: 15000 });

  const admin = await clientAs('admin');
  const { data } = await admin.from('companies').select('types, phone').eq('name', NEW_ACCOUNT).single();
  expect(data).toEqual({ types: ['client'], phone: '+63 2 8123 4567' });
});

test('FOOS-8: a requisition import refuses rows whose account does not exist, before writing anything', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await mockSheet(page, [{ Role: 'QA Import Role', Client: `No Such Account ${RUN}` }]);
  await gotoAsSignedIn(page, '/intake/sheet');
  await pick(page, /^Target/, 'Requisition (imports directly)');
  await page.getByLabel(/Sheet URL/).fill('https://docs.google.com/spreadsheets/d/qa-import');
  await page.getByRole('button', { name: 'Fetch' }).click();
  await pick(page, /^Title/, 'Role');
  await pick(page, /^Account name/, 'Client');
  await page.getByRole('button', { name: 'Continue to preview' }).click();
  await expect(page.getByText(/Row 2: account “No Such Account .*” does not exist/)).toBeVisible();
  await expect(page.getByRole('heading', { name: /Import Preview/ })).toHaveCount(0);
});

test('FOOS-8: a sourcer is not offered account or requisition imports', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/intake/sheet');
  await page.getByRole('combobox', { name: 'Target' }).click();
  await expect(page.getByRole('option', { name: /Account/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: /Requisition/ })).toHaveCount(0);
});
