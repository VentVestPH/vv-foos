import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const tag = `qa-tmpl-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('email_templates').delete().like('name', `${tag}%`);
  if (error) throw new Error(`could not clean up templates: ${error.message}`);
});

test.describe('Q4: email templates', () => {
  test('a recruiter creates a template and it appears in the outreach dialog', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/settings');

    const card = page.locator('.settings-card').filter({ hasText: 'Email templates' });
    await expect(card).toBeVisible({ timeout: 25000 });
    await card.getByLabel('Template name').fill(`${tag} screen invite`);
    await card.getByLabel('Subject').fill('Screening call, {{first_name}}');
    await card
      .getByLabel('Message')
      .fill('Hi {{first_name}} {{last_name}}, are you free this week?');
    await card.getByRole('button', { name: 'Add template' }).click();

    await expect(card.getByText(`${tag} screen invite`)).toBeVisible({ timeout: 20000 });

    await gotoAsSignedIn(page, '/recruit/candidates');
    const firstRow = page.locator('.table-wrap tbody tr[data-row-key]').first();
    await expect(firstRow).toBeVisible({ timeout: 25000 });
    const cells = await firstRow.locator('td').allTextContents();
    const name = (cells.find((c) => /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(c.trim())) ?? '').trim();
    await firstRow.click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/, { timeout: 20000 });

    await page.getByRole('button', { name: 'Send Email' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Send email' });
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await dialog.getByLabel('Template').selectOption({ label: `${tag} screen invite` });

    const first = name.split(/\s+/)[0] ?? '';
    await expect(dialog.getByLabel('Subject')).toHaveValue(`Screening call, ${first}`);
    const body = await dialog.getByLabel('Message').inputValue();
    expect(body).toContain(`Hi ${first} `);
    expect(body).not.toContain('{{');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
  });

  test('a sourcer can read templates but not change them', async ({ page }) => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('email_templates').insert({
      name: `${tag} readonly`,
      subject: 'Hello {{first_name}}',
      body: 'Body for {{full_name}}',
    });
    expect(error, error?.message).toBeNull();

    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/settings');
    const card = page.locator('.settings-card').filter({ hasText: 'Email templates' });
    await expect(card.getByText(`${tag} readonly`)).toBeVisible({ timeout: 25000 });
    await expect(card.getByRole('button', { name: 'Add template' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Edit' })).toHaveCount(0);

    const sourcer = await clientAs('sourcer');
    const refused = await sourcer
      .from('email_templates')
      .insert({ name: `${tag} sneaky`, subject: 's', body: 'b' });
    expect(refused.error?.code).toBe('42501');
  });

  test('a duplicate name is refused rather than creating two templates', async ({ page }) => {
    const admin = await clientAs('admin');
    const name = `${tag} unique`;
    expect((await admin.from('email_templates').insert({ name, subject: 's', body: 'b' })).error)
      .toBeNull();

    const again = await admin.from('email_templates').insert({ name: name.toUpperCase(), subject: 's', body: 'b' });
    expect(again.error?.code).toBe('23505');

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/settings');
    const card = page.locator('.settings-card').filter({ hasText: 'Email templates' });
    await expect(card.getByText(name, { exact: true })).toHaveCount(1, { timeout: 25000 });
  });
});
