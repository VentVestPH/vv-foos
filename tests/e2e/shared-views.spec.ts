import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, optionNames, signIn } from './helpers';

const tag = `qa-shared-view-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const SHARED = `${tag} shared`;
const PRIVATE = `${tag} private`;

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
    await dialog.getByLabel('View name').fill(SHARED);
    await dialog.getByRole('checkbox', { name: 'Share with the team' }).check();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    await expect
      .poll(
        async () =>
          (await optionNames(page, page.getByRole('combobox', { name: 'Saved views' }))).join('|'),
        { timeout: 20000 },
      )
      .toContain(`${SHARED} (shared)`);

    const admin = await clientAs('admin');
    const { data } = await admin
      .from('ats_saved_views')
      .select('name, is_shared, staff_id')
      .eq('name', SHARED)
      .single();
    expect(data?.is_shared).toBe(true);
  });

  test('another staff member sees the shared view and not the private one', async ({ browser }) => {
    const admin = await clientAs('admin');
    const owner = 'a0000000-0000-4000-8000-000000000002';
    const rows = await admin
      .from('ats_saved_views')
      .insert([
        { name: PRIVATE, entity: 'candidate', staff_id: owner, filters: {}, is_shared: false },
      ])
      .select('id');
    expect(rows.error, rows.error?.message).toBeNull();

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const offered = await optionNames(page, page.getByRole('combobox', { name: 'Saved views' }));
    expect(offered.join('|')).toContain(`${SHARED} (shared)`);
    expect(offered.join('|')).not.toContain(PRIVATE);
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
