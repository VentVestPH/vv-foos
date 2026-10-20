import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

test('U12: a role-refused route says so in place instead of silently redirecting', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/sales/deals');

  await expect(page.getByRole('heading', { name: 'You do not have access to Sales' })).toBeVisible({
    timeout: 20000,
  });
  expect(new URL(page.url()).pathname, 'the URL must survive a refusal').toBe('/sales/deals');
  await expect(page.getByRole('link', { name: 'Back to Home' })).toBeVisible();
});

test('U12: the refusal leaves history intact, so Back returns where the user came from', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/recruit/requisitions');
  await expect(page.getByRole('heading', { name: /^Requisitions/ })).toBeVisible({
    timeout: 25000,
  });

  await gotoAsSignedIn(page, '/sales/deals');
  await expect(page.getByRole('heading', { name: 'You do not have access to Sales' })).toBeVisible({
    timeout: 20000,
  });

  await page.goBack();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 20000 })
    .toBe('/recruit/requisitions');
});

test('S4: the sourcer requisition refusal is framed like every other refusal', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, '/recruit/requisitions/new');

  const card = page.locator('.hold-card');
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(
    card.getByRole('heading', { name: 'You do not have access to edit requisitions' }),
  ).toBeVisible();
  await expect(card.getByRole('link', { name: 'Back To List' })).toBeVisible();
});

test('the admin-only Users route names itself when refused', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.bd);
  await gotoAsSignedIn(page, '/users');
  await expect(page.getByRole('heading', { name: 'You do not have access to Users' })).toBeVisible({
    timeout: 20000,
  });
});
