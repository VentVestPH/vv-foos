import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const FORMS = [
  ['new company', '/sales/companies/new'],
  ['new contact', '/sales/contacts/new'],
  ['new deal', '/sales/deals/new'],
  ['new requisition', '/recruit/requisitions/new'],
] as const;

test('B4: the test-record flag has one label everywhere', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  const labels = new Set<string>();

  for (const [name, path] of FORMS) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('input[type=\"checkbox\"]').first()).toBeVisible({ timeout: 25000 });
    const found = await page.evaluate(() => {
      const out: string[] = [];
      for (const label of Array.from(document.querySelectorAll('label'))) {
        const text = (label.textContent ?? '').trim();
        if (/test/i.test(text)) out.push(text.replace(/\s+/g, ' '));
      }
      return out;
    });
    expect(found.length, `${name} should offer the test-record flag`).toBeGreaterThan(0);
    found.forEach((f) => labels.add(f));
  }

  expect(
    [...labels],
    'one field, one label. The audit found four wordings including one that printed the column name',
  ).toEqual(['Test record']);
});

test('no user-facing copy names the codebase or the project phase', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page, PERSONA_EMAILS.admin);
  const banned = ['FOOS MVP', 'is_test', 'useSearchParams', 'page shell', 'utility header'];
  const offenders: string[] = [];

  for (const path of [
    '/',
    '/settings',
    '/onboard',
    '/users',
    '/recruit/requisitions/new',
    '/sales/companies/new',
  ]) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 25000 });
    const text = await page.locator('main').innerText();
    for (const phrase of banned) {
      if (text.includes(phrase)) offenders.push(`${path}: "${phrase}"`);
    }
  }

  expect(offenders, 'copy is written for users, not for whoever maintains the code').toEqual([]);
});
