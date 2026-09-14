import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const LISTS = [
  { list: '/sales/companies', crumb: 'Accounts', record: /\/sales\/companies\/[0-9a-f-]{36}$/ },
  { list: '/sales/contacts', crumb: 'Contacts', record: /\/sales\/contacts\/[0-9a-f-]{36}$/ },
  { list: '/sales/deals', crumb: 'Deals', record: /\/sales\/deals\/[0-9a-f-]{36}$/ },
];

test('a sales record returns to the list it was opened from, filters and all', async ({ page }) => {
  test.setTimeout(0);
  await signIn(page, PERSONA_EMAILS.admin);

  for (const { list, crumb, record } of LISTS) {
    const from = `${list}?probe=listreturn`;
    await gotoAsSignedIn(page, from);
    if (list === '/sales/deals') {
      await page.getByRole('tab', { name: 'Table' }).click();
    }
    const row = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').first();
    await expect(row).toBeVisible({ timeout: 25000 });
    await row.click();
    await expect(page).toHaveURL(record, { timeout: 25000 });

    const back = page.getByRole('link', { name: crumb, exact: true }).first();
    await expect(back, 'the trail names the list this record came from').toBeVisible();
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${list}\\?probe=listreturn$`), { timeout: 25000 });
    console.log(`PROBE listReturn ${list} carried its query string back`);
  }
});
