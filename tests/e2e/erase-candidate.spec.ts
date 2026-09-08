import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const tag = `qa-erase-ui-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
let person = '';

test.beforeEach(async () => {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('people')
    .insert({ first_name: tag, last_name: 'Removable', is_test: true })
    .select('id')
    .single();
  if (error) throw error;
  person = data.id;
  const profile = await admin.from('candidate_profiles').insert({ person_id: person });
  if (profile.error) throw profile.error;
});

test.afterEach(async () => {
  const admin = await clientAs('admin');
  await admin.from('candidate_profiles').delete().eq('person_id', person);
  const { error } = await admin.from('people').delete().eq('id', person);
  if (error) throw new Error(`could not remove the erase fixture: ${error.message}`);
  const { data } = await admin.from('people').select('id').eq('id', person);
  if (data?.length) throw new Error(`the erase fixture ${person} survived its teardown`);
});

test.describe('the erasure path a candidate can ask for', () => {
  test('an admin must type the name before the button works', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^More/ }).first().click();
    await page.getByRole('menuitem', { name: 'Erase…' }).click();

    const dialog = page.getByRole('dialog', { name: 'Erase this candidate' });
    const confirm = dialog.getByRole('button', { name: 'Erase permanently' });
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel('Why (recorded on the receipt)').fill(`${tag} asked to be removed`);
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Type the candidate's name/).fill('Wrong Name');
    await expect(confirm).toBeDisabled();

    await dialog.getByLabel(/Type the candidate's name/).fill(`${tag} Removable`);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await page.waitForURL(/\/recruit\/candidates$/, { timeout: 25000 });

    const admin = await clientAs('admin');
    expect((await admin.from('people').select('id').eq('id', person)).data).toHaveLength(0);
    const receipt = await admin
      .from('erasure_log')
      .select('reason, counts')
      .eq('person_id', person)
      .single();
    expect(receipt.data?.reason).toBe(`${tag} asked to be removed`);
  });

  test('a recruiter is not offered the erase action at all', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^More/ }).first().click();
    await expect(page.getByRole('menuitem', { name: 'Merge duplicate…' })).toBeVisible({
      timeout: 25000,
    });
    await expect(
      page.getByRole('menuitem', { name: 'Erase…' }),
      'a recruiter must not be offered erase, even inside the menu',
    ).toHaveCount(0);
  });
});
