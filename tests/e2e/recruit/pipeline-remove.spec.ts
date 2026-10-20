import { expect, test } from '@playwright/test';
import { clientAs } from '../../support/env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const REQUISITION = 'd0000000-0000-4000-8000-000000000001';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const FIRST = `Qspipe${RUN}`;
const LAST = 'Removable';

let person = '';

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const created = await admin
    .from('people')
    .insert({ first_name: FIRST, last_name: LAST, is_test: true })
    .select('id')
    .single();
  if (created.error) throw created.error;
  person = created.data.id;
  const profile = await admin.from('candidate_profiles').insert({ person_id: person });
  if (profile.error) throw profile.error;
  const application = await admin
    .from('applications')
    .insert({ requisition_id: REQUISITION, person_id: person, stage: 'received' });
  if (application.error) throw application.error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('applications').delete().eq('person_id', person);
  await admin.from('candidate_profiles').delete().eq('person_id', person);
  const { error } = await admin.from('people').delete().eq('id', person);
  if (error) throw new Error(`could not remove the pipeline fixture: ${error.message}`);
});

test('a recruiter removes a candidate from the Application Pipeline, and the candidate record stays', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, `/recruit/requisitions/${REQUISITION}`);

  const remove = page.getByRole('button', { name: `Remove ${FIRST} ${LAST} from this requisition` });
  await expect(remove).toBeVisible({ timeout: 25000 });
  await remove.click();

  const dialog = page.getByRole('dialog', { name: 'Remove candidate from requisition?' });
  await expect(dialog).toContainText(`${FIRST} ${LAST}`);
  await dialog.getByRole('button', { name: 'Remove from requisition' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 20000 });
  await expect(remove).toHaveCount(0);

  const admin = await clientAs('admin');
  await expect
    .poll(async () => {
      const { data } = await admin.from('applications').select('id').eq('person_id', person);
      return data?.length ?? -1;
    }, { timeout: 20000 })
    .toBe(0);
  const { data: kept } = await admin.from('people').select('id').eq('id', person);
  expect(kept).toHaveLength(1);
});

test('a sourcer sees no Remove control in the pipeline', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, `/recruit/requisitions/${REQUISITION}`);
  await expect(page.getByRole('heading', { name: /Application Pipeline|Applications/ }).first()).toBeVisible({
    timeout: 25000,
  });
  await expect(page.getByRole('button', { name: /from this requisition$/ })).toHaveCount(0);
});
