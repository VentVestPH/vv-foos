import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';
import { clientAs } from '../../support/env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const NOTE = `QA rail ${RUN}`;
let contactId: string | null = null;

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data } = await admin.from('contact_list').select('person_id').order('person_id').limit(1);
  contactId = (data?.[0]?.person_id as string) ?? null;
  expect(contactId, 'a contact to inspect').toBeTruthy();
  await admin
    .from('activities')
    .delete()
    .like('subject', 'QA rail %')
    .eq('body', 'written by the empty-rail test')
    .lt('occurred_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());
});

test.afterEach(async () => {
  const admin = await clientAs('admin');
  await admin.from('activities').delete().like('subject', `${NOTE}%`);
});

test('B6: the tab strip renders on an untouched record, so the kinds on offer are visible', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/sales/contacts/${contactId}`);
  await expect(page.getByRole('button', { name: /^Engagement/ })).toBeVisible({ timeout: 25000 });

  await expect(
    page.locator('.side-tabs-bar'),
    'reversed 2026-09-14 on Klent\'s instruction. This used to assert the strip was absent when every tab was empty, to avoid two "nothing here" messages side by side. Hiding it also hid what a record can hold, so a new account read as though Notes, Calls, Files and the rest did not exist',
  ).toBeVisible();

  await expect(page.getByRole('tab', { name: /^Notes/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Files/ })).toBeVisible();
  await expect(
    page.locator('.side-tabs'),
    'each tab still carries its own empty state rather than showing a blank panel',
  ).toContainText(/No .*(yet|logged)/i);
});

test('B6: the rail comes back as soon as there is something to show', async ({ page }) => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('activities').insert({
    kind: 'note',
    subject: `${NOTE} note`,
    body: 'written by the empty-rail test',
    occurred_at: new Date().toISOString(),
    person_id: contactId,
  });
  expect(error).toBeNull();

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/sales/contacts/${contactId}`);
  await expect(page.locator('.side-tabs-bar'), 'the rail must return with content').toBeVisible({
    timeout: 25000,
  });
  await expect(page.getByRole('tab', { name: /^Notes/ })).toBeVisible();
});
