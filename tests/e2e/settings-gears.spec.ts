import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const SEEDED_REQUISITION = 'd0000000-0000-4000-8000-000000000001';
const PREF_KEYS = [
  'ui.sections.dashboard.myview',
  'ui.sections.dashboard.reports',
  'ui.recentlyViewed',
];

test.afterAll(async () => {
  const client = await clientAs('admin');
  await client.from('integration_settings').delete().in('key', PREF_KEYS);
});

test.beforeEach(async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
});

test('the header Settings gear navigates in the SPA without a full document load', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await page.evaluate(() => {
    (window as unknown as { __spaMarker?: string }).__spaMarker = 'kept';
  });

  await page.locator('.fo-utility-actions').getByRole('button', { name: 'Settings' }).click();

  await expect(page.getByRole('heading', { name: 'Administration: Settings' })).toBeVisible();
  expect(page.url()).toContain('/settings');
  const marker = await page.evaluate(
    () => (window as unknown as { __spaMarker?: string }).__spaMarker ?? null,
  );
  expect(marker).toBe('kept');
});

test('the header Reports gear navigates in the SPA without a full document load', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await page.evaluate(() => {
    (window as unknown as { __spaMarker?: string }).__spaMarker = 'kept';
  });

  await page.locator('.fo-utility-actions').getByRole('button', { name: 'Reports' }).click();

  await expect(page.getByRole('heading', { name: 'Run Report' })).toBeVisible();
  const marker = await page.evaluate(
    () => (window as unknown as { __spaMarker?: string }).__spaMarker ?? null,
  );
  expect(marker).toBe('kept');
});

for (const [label, path, gear] of [
  ['candidates', '/recruit/candidates', 'Configure candidate list columns'],
  ['intake queue', '/intake', 'Configure columns'],
] as const) {
  test(`the ${label} gear opens the filter rail and puts focus on the first column checkbox`, async ({
    page,
  }) => {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('.filter-rail')).toHaveCount(0);

    await page.getByRole('button', { name: gear }).click();

    const rail = page.locator('.filter-rail');
    await expect(rail).toBeVisible();
    const firstColumn = rail.locator('.checkbox-list input[type="checkbox"]').first();
    await expect(firstColumn).toBeFocused();
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  });
}

test('the dashboard settings gear hides a section, and the choice survives a reload', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/');
  const section = page.getByRole('button', { name: /^My Reminders/ });
  await expect(section).toBeVisible();

  await page.getByRole('button', { name: 'Dashboard settings' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dashboard settings' });
  await expect(dialog).toBeVisible();

  const toggle = dialog.getByRole('checkbox', { name: 'My Reminders', exact: true });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(section).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect(dialog).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('button', { name: /^My Calendar/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^My Reminders/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Dashboard settings' }).click();
  const reopened = page.getByRole('dialog', { name: 'Dashboard settings' });
  await reopened.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByRole('button', { name: /^My Reminders/ })).toBeVisible();
  await reopened.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: /^My Reminders/ })).toBeVisible();
});

test('the report categories gear hides a report section, and the choice survives a reload', async ({
  page,
}) => {
  await gotoAsSignedIn(page, '/reports');
  const section = page.getByRole('button', { name: /^Requisition Aging/ });
  await expect(section).toBeVisible();

  await page.getByRole('button', { name: 'Configure report categories' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report categories' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('checkbox', { name: 'Requisition Aging', exact: true }).uncheck();
  await expect(section).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Done' }).click();

  await page.reload();
  await expect(page.getByRole('button', { name: /^Pipeline by Stage/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Requisition Aging/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Configure report categories' }).click();
  const reopened = page.getByRole('dialog', { name: 'Report categories' });
  await reopened.getByRole('button', { name: 'Show all' }).click();
  await reopened.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Requisition Aging/ })).toBeVisible();
});

test('the Recently Viewed gear sets how many records are kept, and clears the list', async ({
  page,
}) => {
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED_REQUISITION}`);
  await expect.poll(() => page.title(), { timeout: 25000 }).toMatch(/REQ-\d+/);
  await expect(page.locator('.fo-recent-item')).not.toHaveCount(0);

  await page.getByRole('button', { name: 'Configure Recently Viewed' }).click();
  const popover = page.locator('.fo-recent-settings');
  await expect(popover).toBeVisible();

  const limit = popover.getByLabel('Records to keep');
  await expect(limit).toHaveAttribute('placeholder', '10');
  await limit.fill('5');
  await popover.getByRole('button', { name: 'Save' }).click();
  await expect(popover).toHaveCount(0);

  await page.getByRole('button', { name: 'Configure Recently Viewed' }).click();
  const reopened = page.locator('.fo-recent-settings');
  await expect(reopened.getByLabel('Records to keep')).toHaveValue('5');

  await reopened.getByRole('button', { name: 'Clear list' }).click();
  await expect(reopened).toHaveCount(0);
  await expect(page.locator('.fo-recent-item')).toHaveCount(0);
  await expect(page.getByText('Records you open will appear here.')).toBeVisible();
  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
});

test('the four Taleo module placeholders no longer offer a configuration gear', async ({
  page,
}) => {
  for (const path of ['/employees', '/onboard', '/users', '/courses']) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('.list-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Configure this list' })).toHaveCount(0);
  }
});

test('no gear anywhere in the shell opens the not-part-of-FOOS placeholder', async ({ page }) => {
  const gears: [string, string][] = [
    ['/', 'Dashboard settings'],
    ['/reports', 'Configure report categories'],
    ['/recruit/candidates', 'Configure candidate list columns'],
    ['/intake', 'Configure columns'],
    ['/recruit/requisitions', 'Configure Recently Viewed'],
  ];
  for (const [path, name] of gears) {
    await gotoAsSignedIn(page, path);
    await page.getByRole('button', { name }).click();
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
    await page.keyboard.press('Escape');
  }
});
