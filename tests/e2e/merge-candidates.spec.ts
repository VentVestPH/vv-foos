import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const tag = `qa-merge-ui-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
let survivor = '';
let duplicate = '';

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const make = async (last: string, extra: Record<string, unknown>) => {
    const { data, error } = await admin
      .from('people')
      .insert({ first_name: tag, last_name: last, is_test: true, ...extra })
      .select('id')
      .single();
    if (error) throw error;
    const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
    if (profile.error) throw profile.error;
    return data.id;
  };
  survivor = await make('Keeper', { city: 'Manila' });
  duplicate = await make('Duplicate', { headline: 'Only on the duplicate' });

  const sourcer = await clientAs('sourcer');
  const me = await sourcer.auth.getUser();
  const owned = await admin
    .from('candidate_profiles')
    .update({ sourcer_id: me.data.user?.id })
    .eq('person_id', survivor);
  if (owned.error) throw owned.error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const ids = [survivor, duplicate].filter(Boolean);
  await admin.from('activities').delete().in('person_id', ids);
  await admin.from('candidate_profiles').delete().in('person_id', ids);
  const { error } = await admin.from('people').delete().in('id', ids);
  if (error) throw new Error(`could not clean up merged people: ${error.message}`);
});

test.describe('Q2: merging two candidate records', () => {
  test('a recruiter merges the duplicate away and keeps the survivor', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${survivor}`);
    const merge = page.getByRole('button', { name: 'Merge duplicate…' }).first();
    await expect(merge).toBeEnabled({ timeout: 25000 });
    await merge.click();
    const dialog = page.getByRole('dialog', { name: 'Merge a duplicate into this record' });
    await dialog.getByLabel('Find the duplicate by name').fill(tag);

    const option = dialog.getByRole('radio');
    await expect(option.first()).toBeVisible({ timeout: 20000 });
    await option.first().check();

    await expect(dialog.locator('.merge-compare')).toContainText('Manila');
    await expect(dialog.locator('.merge-compare')).toContainText('Only on the duplicate');

    await dialog.getByRole('button', { name: 'Merge and delete the duplicate' }).click();
    await expect(dialog).toBeHidden({ timeout: 25000 });

    const admin = await clientAs('admin');
    const { data } = await admin.from('people').select('id, city, headline').in('id', [survivor, duplicate]);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(survivor);
    expect(data?.[0]?.city).toBe('Manila');
    expect(data?.[0]?.headline).toBe('Only on the duplicate');

    await expect(page.getByText('Only on the duplicate')).toBeVisible({ timeout: 20000 });
    duplicate = '';
  });

  test('a sourcer cannot reach the merge at all', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, `/recruit/candidates/${survivor}`);
    const button = page.getByRole('button', { name: 'Merge duplicate…' }).first();
    await expect(button).toBeDisabled({ timeout: 25000 });
    await expect(button).toHaveAttribute(
      'title',
      'Only an admin or a recruiter can merge candidates',
    );
  });
});
