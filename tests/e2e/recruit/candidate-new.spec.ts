import { expect, test } from '@playwright/test';
import { clientAs } from '../../support/env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const FIRST = `Newfirst${RUN}`;
const LAST = `Newlast${RUN}`;
const DUP_FIRST = `Dupfirst${RUN}`;
const DUP_LAST = `Duplast${RUN}`;

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { data } = await admin.from('people').select('id').like('first_name', `%${RUN}`);
  const ids = (data ?? []).map((p) => p.id);
  if (ids.length === 0) return;
  await admin.from('applications').delete().in('person_id', ids);
  await admin.from('candidate_profiles').delete().in('person_id', ids);
  await admin.from('people').delete().in('id', ids);
});

test.describe('N: adding a candidate', () => {
  test('N1: the list offers Add Candidate and Import from Sheets', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    await expect(page.getByRole('button', { name: 'Add Candidate' })).toBeVisible({
      timeout: 25000,
    });
    await page.getByRole('button', { name: 'Import from Sheets' }).click();
    await expect(page).toHaveURL(/\/intake\/sheet/);
  });

  test('N2: sections appear one at a time and only the names are required', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates/new');

    await expect(page.getByRole('region', { name: 'Requisition' })).toBeVisible({
      timeout: 25000,
    });
    await expect(page.getByRole('region', { name: 'Candidate Information' })).toHaveCount(0);

    const create = page.getByRole('button', { name: 'Create candidate' });
    await expect(create, 'nothing can be created without a name').toBeDisabled();

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('region', { name: 'Candidate Information' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Main Status Details' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'First name is required.' }).first(),
    ).toBeVisible();

    await page.getByLabel('First name').fill(FIRST);
    await page.getByLabel('Last name').fill(LAST);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('region', { name: 'Main Status Details' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'More Details' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('region', { name: 'More Details' })).toBeVisible();
  });

  test('N3: a candidate is created from just the two names', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates/new');
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByLabel('First name').fill(FIRST);
    await page.getByLabel('Last name').fill(LAST);
    await page.getByRole('button', { name: 'Create candidate' }).click();

    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}$/, { timeout: 25000 });

    const admin = await clientAs('admin');
    const { data } = await admin
      .from('people')
      .select('id, candidate_profiles(person_id)')
      .eq('first_name', FIRST)
      .eq('last_name', LAST);
    expect(data?.length, 'one person was created').toBe(1);
  });

  test('N4: an existing person with the same name is flagged but does not block', async ({
    page,
  }) => {
    const admin = await clientAs('admin');
    const { data: made, error } = await admin
      .from('people')
      .insert({ first_name: DUP_FIRST, last_name: DUP_LAST, is_test: true })
      .select('id')
      .single();
    if (error) throw error;
    const profile = await admin.from('candidate_profiles').insert({ person_id: made.id });
    if (profile.error) throw profile.error;

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates/new');
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByLabel('First name').fill(DUP_FIRST);
    await page.getByLabel('Last name').fill(DUP_LAST);
    await page.getByLabel('Last name').blur();

    const warning = page.locator('.cand-dup');
    await expect(warning).toBeVisible({ timeout: 15000 });
    await expect(warning.getByRole('link', { name: 'Open existing candidate' })).toBeVisible();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('region', { name: 'Main Status Details' })).toBeVisible();
  });
});
