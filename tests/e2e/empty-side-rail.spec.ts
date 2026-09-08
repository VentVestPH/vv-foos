import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const NOTE = `QA rail ${RUN}`;
let contactId: string | null = null;

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data } = await admin.from('contact_list').select('person_id').order('person_id').limit(1);
  contactId = (data?.[0]?.person_id as string) ?? null;
  expect(contactId, 'a contact to inspect').toBeTruthy();
});

test.afterEach(async () => {
  const admin = await clientAs('admin');
  await admin.from('activities').delete().like('subject', `${NOTE}%`);
});

test('B6: a record with nothing logged shows one empty state, not two side by side', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/sales/contacts/${contactId}`);
  await expect(page.getByRole('button', { name: /^Engagement/ })).toBeVisible({ timeout: 25000 });

  const emptyStates = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('main p'))
      .map((p) => (p.textContent ?? '').trim())
      .filter((t) => /^No .*(yet|logged)\.?$/i.test(t));
    return texts;
  });

  expect(
    emptyStates.length,
    `one record should not carry two "nothing here" messages: ${emptyStates.join(' | ')}`,
  ).toBeLessThanOrEqual(1);
  await expect(
    page.locator('.side-tabs-bar'),
    'the eight-tab strip must not render when every tab is empty',
  ).toHaveCount(0);
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
