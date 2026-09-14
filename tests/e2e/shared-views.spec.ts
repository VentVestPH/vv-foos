import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, optionNames, signIn } from './helpers';
import { STAFF_IDS } from '../fixtures/seed-ids';

const tag = `qa-shared-view-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const UI_SHARED = `${tag} ui shared`;
const SHARED = `${tag} shared`;
const PRIVATE = `${tag} private`;
const RECRUITER_ID = STAFF_IDS.recruiter;

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('ats_saved_views').insert([
    { name: SHARED, entity: 'candidate', staff_id: RECRUITER_ID, filters: {}, is_shared: true },
    { name: PRIVATE, entity: 'candidate', staff_id: RECRUITER_ID, filters: {}, is_shared: false },
  ]);
  if (error) throw new Error(`could not seed the saved views: ${error.message}`);
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('ats_saved_views').delete().like('name', `${tag}%`);
  if (error) throw new Error(`could not clean up saved views: ${error.message}`);
});

test.describe('Q5: a saved view can be shared with the team', () => {
  test('the save dialog offers sharing and records it', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
      timeout: 25000,
    });

    await page.getByRole('button', { name: 'Save view' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('View name').fill(UI_SHARED);
    await dialog.getByRole('checkbox', { name: 'Share with the team' }).check();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    await expect
      .poll(
        async () =>
          (await optionNames(page, page.getByRole('combobox', { name: 'Saved views' }))).join('|'),
        { timeout: 20000 },
      )
      .toContain(`${UI_SHARED} (shared)`);

    const admin = await clientAs('admin');
    const { data } = await admin
      .from('ats_saved_views')
      .select('name, is_shared, staff_id')
      .eq('name', UI_SHARED)
      .single();
    expect(data?.is_shared).toBe(true);
  });

  test('another staff member sees the shared view and not the private one', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const select = page.getByRole('combobox', { name: 'Saved views' });
    let offered = '';
    await expect
      .poll(
        async () => {
          offered = (await optionNames(page, select)).join('|');
          return offered;
        },
        { timeout: 25000 },
      )
      .toContain(`${SHARED} (shared)`);
    expect(offered).not.toContain(PRIVATE);
    await context.close();
  });

  test('a shared view cannot be deleted by someone who does not own it', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const select = page.getByRole('combobox', { name: 'Saved views' });
    await expect
      .poll(async () => (await optionNames(page, select)).join('|'), { timeout: 25000 })
      .toContain(`${SHARED} (shared)`);
    await chooseOption(page, select, `${SHARED} (shared)`);

    const remove = page.getByRole('button', { name: 'Delete view' });
    await expect(remove).toBeDisabled();
    await expect(remove).toHaveAttribute(
      'title',
      'Only the person who shared this view can delete it',
    );
  });

  test('RLS refuses the delete even without the button', async () => {
    const sourcer = await clientAs('sourcer');
    const { error } = await sourcer.from('ats_saved_views').delete().eq('name', SHARED);
    expect(error).toBeNull();

    const admin = await clientAs('admin');
    const { data } = await admin.from('ats_saved_views').select('id').eq('name', SHARED);
    expect(data, 'the row must survive a delete a non-owner is not allowed to make').toHaveLength(1);
  });
});

test.describe('Q5: the entity column keeps one list\'s views out of another', () => {
  const COMPANY_VIEW = `${tag} company shared`;
  const INTAKE_VIEW = `${tag} intake shared`;

  test.beforeAll(async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('ats_saved_views').insert([
      { name: COMPANY_VIEW, entity: 'company', staff_id: RECRUITER_ID, filters: {}, columns: ['name'], is_shared: true },
      { name: INTAKE_VIEW, entity: 'intake', staff_id: RECRUITER_ID, filters: {}, columns: ['full_name'], is_shared: true },
    ]);
    if (error) throw new Error(`could not seed the entity fixtures: ${error.message}`);
  });

  test('an account view is offered on accounts and nowhere else', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.bd);

    await gotoAsSignedIn(page, '/sales/companies');
    const onAccounts = await optionNames(page, page.getByRole('combobox', { name: 'Saved views' }));
    expect(
      onAccounts.join('|'),
      'a shared account view reaches another staff member, because ats_saved_views_read passes any row with is_shared',
    ).toContain(COMPANY_VIEW);
    expect(
      onAccounts.join('|'),
      'entity is the only thing separating these lists, so an intake view must not appear here',
    ).not.toContain(INTAKE_VIEW);

    await gotoAsSignedIn(page, '/intake');
    const onIntake = await optionNames(page, page.getByRole('combobox', { name: 'Saved views' }));
    expect(onIntake.join('|')).toContain(INTAKE_VIEW);
    expect(onIntake.join('|')).not.toContain(COMPANY_VIEW);
  });

  test('the four entities are stored under their own names', async () => {
    const admin = await clientAs('admin');
    const { data } = await admin
      .from('ats_saved_views')
      .select('name, entity')
      .like('name', `${tag}%`);
    const byEntity = new Map((data ?? []).map((r) => [r.name, r.entity]));
    expect(byEntity.get(COMPANY_VIEW), 'an accounts view is entity company').toBe('company');
    expect(byEntity.get(INTAKE_VIEW), 'an intake view is entity intake').toBe('intake');
    expect(
      byEntity.get(SHARED),
      'the candidate fixtures above are untouched by the new entities',
    ).toBe('candidate');
  });
});
