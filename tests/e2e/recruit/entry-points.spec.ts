import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const OPEN_REQUISITION = 'd0000000-0000-4000-8000-000000000001';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('FOOSBR-8: a company missing from the requisition form has a way forward', () => {
  test('an admin is offered the new account page', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/requisitions/new');
    await page.getByRole('button', { name: 'About Company' }).click({ timeout: 20000 });
    const link = page.getByRole('link', { name: /Create the account in a new tab/ });
    await expect(link).toBeVisible({ timeout: 20000 });
    await expect(link).toHaveAttribute('href', '/sales/companies/new');
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('a recruiter, who cannot create accounts, is told who can', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions/new');
    await page.getByRole('button', { name: 'About Company' }).click({ timeout: 20000 });
    await expect(page.getByText(/Ask an admin or BD to add the account/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('link', { name: /Create the account/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Ask an admin/)).toHaveCount(0);
  });
});

test.describe('FOOSBR-11: a candidate who is not in FOOS yet can be added from a requisition', () => {
  test('the Add candidate dialog points at Intake when nothing matches', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/requisitions/${OPEN_REQUISITION}`);
    await page.getByRole('button', { name: 'Add candidate' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Add candidate' });
    await dialog.getByLabel('Search candidates').fill(`zzno-such-person-${RUN}`);
    await expect(dialog.getByText(/No matching candidates/)).toBeVisible({ timeout: 20000 });
    await expect(dialog.getByRole('link', { name: 'CSV file' })).toHaveAttribute('href', '/intake/sheet');
    await dialog.getByRole('link', { name: 'LinkedIn profile' }).click();
    await expect(page).toHaveURL(/\/intake\/linkedin$/);
  });
});

test.describe('FOOSBR-12: a candidate list can be uploaded as a CSV file', () => {
  test('choosing a local .csv file goes straight to column mapping with its rows', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/intake/sheet');
    const csv = `Full Name,Email Address\nQa Upload ${RUN},qa-upload-${RUN}@example.test\n"Doe, Jane",jane-${RUN}@example.test\n`;
    await page.getByLabel('CSV file').setInputFiles({
      name: 'candidates.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });
    await expect(page.getByRole('heading', { name: 'Intake: Map Columns' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Sample of 2 row\(s\)/)).toBeVisible();
  });

  test('a file with only a heading row is refused with a reason', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/intake/sheet');
    await page.getByLabel('CSV file').setInputFiles({
      name: 'empty.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Full Name,Email Address\n'),
    });
    await expect(page.getByRole('alert').filter({ hasText: 'no data rows' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Intake: Map Columns' })).toHaveCount(0);
  });
});
