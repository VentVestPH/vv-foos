import { expect, test } from '@playwright/test';
import { clientAs } from '../../support/env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';
import { STAFF_IDS } from '../../support/fixtures/seed-ids';

const tag = `qa-default-view-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const OWN = `${tag} own`;
const SHARED_DEFAULT = `Default`;

let ownViewId = '';
let createdDefault = false;

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data: existing } = await admin
    .from('ats_saved_views')
    .select('id')
    .eq('entity', 'requisition')
    .eq('is_shared', true)
    .eq('name', SHARED_DEFAULT);
  if ((existing ?? []).length === 0) {
    const made = await admin.from('ats_saved_views').insert({
      name: SHARED_DEFAULT,
      entity: 'requisition',
      staff_id: STAFF_IDS.admin,
      filters: {},
      is_shared: true,
    });
    if (made.error) throw new Error(`could not seed the shared default: ${made.error.message}`);
    createdDefault = true;
  }
  const own = await admin
    .from('ats_saved_views')
    .insert({
      name: OWN,
      entity: 'requisition',
      staff_id: STAFF_IDS.recruiter,
      filters: {},
      is_shared: false,
    })
    .select('id')
    .single();
  if (own.error) throw new Error(`could not seed the personal view: ${own.error.message}`);
  ownViewId = own.data.id;
  await admin.from('ats_view_defaults').delete().eq('staff_id', STAFF_IDS.recruiter);
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('ats_view_defaults').delete().eq('staff_id', STAFF_IDS.recruiter);
  await admin.from('ats_saved_views').delete().like('name', `${tag}%`);
  if (createdDefault) {
    await admin
      .from('ats_saved_views')
      .delete()
      .eq('entity', 'requisition')
      .eq('is_shared', true)
      .eq('name', SHARED_DEFAULT)
      .eq('staff_id', STAFF_IDS.admin);
  }
});

test.describe('D: lists open on the remembered view', () => {
  test('D1: with nothing remembered the shared Default is loaded', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await expect(page.getByRole('combobox', { name: 'Saved views' })).toContainText(
      'Default (shared)',
      { timeout: 25000 },
    );
  });

  test('D2: the view a person picks becomes what the list opens on next time', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await chooseOption(page, page.getByRole('combobox', { name: 'Saved views' }), OWN);

    const admin = await clientAs('admin');
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('ats_view_defaults')
            .select('view_id')
            .eq('staff_id', STAFF_IDS.recruiter)
            .eq('entity', 'requisition')
            .maybeSingle();
          return data?.view_id ?? null;
        },
        { timeout: 20000, message: 'picking a view has to be remembered for that person' },
      )
      .toBe(ownViewId);

    await gotoAsSignedIn(page, '/recruit/requisitions');
    await expect(page.getByRole('combobox', { name: 'Saved views' })).toContainText(OWN, {
      timeout: 25000,
    });
  });

  test('D3: another person is not affected by that choice', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/requisitions');
    await expect(page.getByRole('combobox', { name: 'Saved views' })).not.toContainText(OWN, {
      timeout: 25000,
    });
  });
});
