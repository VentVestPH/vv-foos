import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, searchList, signIn } from '../../support/e2e-helpers';

async function headers(page: import('@playwright/test').Page): Promise<string[]> {
  await expect(page.locator('main table tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 25000,
  });
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main table thead th')).map((th) =>
      (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  );
}

test('batch 1: a column with no value on any visible row is not rendered', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);

  await gotoAsSignedIn(page, '/sales/companies');
  await searchList(page, 'Search Accounts', 'Aster Analytics');
  await expect(page.locator('main table tbody tr[data-row-key]')).toHaveCount(1, { timeout: 25000 });
  await expect(page.locator('main table tbody tr[data-row-key]').first()).toContainText('Aster Analytics');
  const withoutState = await headers(page);
  expect(withoutState, 'Accounts should still render its populated columns').toContain('City');
  expect(
    withoutState,
    'no visible row carries a state, so the column must not take width',
  ).not.toContain('State/Territory');

  await searchList(page, 'Search Accounts', 'Meridian');
  await expect(page.locator('main table tbody tr[data-row-key]').first()).toContainText('Meridian', { timeout: 25000 });
  expect(
    await headers(page),
    'one visible row carries a state, so the column has to come back',
  ).toContain('State/Territory');

  await gotoAsSignedIn(page, '/sales/contacts');
  const contactHeaders = await headers(page);
  expect(contactHeaders).toContain('Name');
  expect(contactHeaders, 'Since is empty on every visible row').not.toContain('Since');
});

test('tickets show populated sortable columns in table view', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/tickets');
  await expect(page.getByText('Confirm interview panel availability')).toBeVisible({ timeout: 25000 });
  const ticketHeaders = await page.evaluate(() =>
    Array.from(document.querySelectorAll('main table thead th')).map((th) =>
      (th.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  );
  expect(ticketHeaders, 'ticket list headers are present').toContain('Subject');
  expect(ticketHeaders.length).toBeGreaterThan(3);
  await expect(page.locator('main table thead th .th-sort-btn')).toHaveCount(ticketHeaders.length);
});

test('batch 1: admin keeps the Company column, because admin can read company names', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  const adminHeaders = await headers(page);
  expect(adminHeaders, 'admin can read company names, so the column stays').toContain('Company');
});

test('batch 1: the sourcer loses the Company column, because RLS leaves it empty', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  const sourcerHeaders = await headers(page);
  expect(
    sourcerHeaders,
    'the sourcer cannot read company names, so an all-empty column must go',
  ).not.toContain('Company');
});
