import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';
import { clientAs } from '../../support/env';

const SEEDED = 'd0000000-0000-4000-8000-000000000002';
let originalStatus: string | null = null;

test.beforeEach(async () => {
  const admin = await clientAs('admin');
  const { data } = await admin.from('requisitions').select('status').eq('id', SEEDED).single();
  originalStatus = (data?.status as string) ?? null;
  expect(originalStatus, 'the seeded requisition must exist').toBeTruthy();
});

test.afterEach(async () => {
  if (!originalStatus) return;
  const admin = await clientAs('admin');
  await admin.from('requisitions').update({ status: originalStatus }).eq('id', SEEDED);
  const { data } = await admin.from('requisitions').select('status').eq('id', SEEDED).single();
  expect(data?.status, 'the seeded requisition must be put back').toBe(originalStatus);
  originalStatus = null;
});

test('K19: the bulk bar changes status for real, and the change is put back', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/requisitions?search=REQ-0002');

  const row = page.locator('tbody tr', { hasText: 'REQ-0002' });
  await expect(row, 'the seeded requisition must be listed').toBeVisible({ timeout: 25000 });
  await row.locator('input[type="checkbox"]').first().check();

  const picker = page.getByRole('combobox', { name: 'Change status to' });
  await expect(picker, 'the bulk control must be a real picker, not a placeholder').toBeVisible();
  await picker.click();
  await page.getByRole('option', { name: 'Mark filled' }).click();

  await expect
    .poll(
      async () => {
        const admin = await clientAs('admin');
        const { data } = await admin
          .from('requisitions')
          .select('status')
          .eq('id', SEEDED)
          .single();
        return data?.status as string | undefined;
      },
      { timeout: 25000, message: 'the bulk status change must reach the database' },
    )
    .toBe('filled');

  await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
});

test('K19: the requisition record no longer offers controls with nothing behind them', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED}`);
  await expect(page.locator('.record-breadcrumb .fo-breadcrumbs')).toBeVisible({ timeout: 25000 });

  for (const gone of ['Send To', 'Forms', 'Attach Contact']) {
    await expect(
      page.getByRole('button', { name: gone, exact: true }),
      `${gone} has nothing behind it and must not be offered`,
    ).toHaveCount(0);
  }
});

test('K19: the requisition record shows the linked company contacts instead of a dead button', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/requisitions/${SEEDED}`);
  const header = page.getByRole('button', { name: /^Company contacts/ });
  await expect(header, 'the section must name itself and its count').toBeVisible({
    timeout: 25000,
  });
  if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
  await expect(page.getByText('No contacts attached.')).toHaveCount(0);
});
