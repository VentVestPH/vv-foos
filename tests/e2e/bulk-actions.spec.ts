import { expect, test, type Page } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, signIn } from './helpers';

interface Snapshot {
  person_id: string;
  status_id: string | null;
  do_not_contact: boolean;
}

const touched = new Map<string, Snapshot>();

async function remember(ids: string[]) {
  const admin = await clientAs('admin');
  const missing = ids.filter((id) => !touched.has(id));
  if (!missing.length) return;
  const { data, error } = await admin
    .from('candidate_profiles')
    .select('person_id, status_id, do_not_contact')
    .in('person_id', missing);
  expect(error, error?.message).toBeNull();
  for (const row of data ?? []) touched.set(row.person_id, row);
}

test.afterAll(async () => {
  if (!touched.size) return;
  const admin = await clientAs('admin');
  for (const snap of touched.values()) {
    const { error } = await admin
      .from('candidate_profiles')
      .update({ status_id: snap.status_id, do_not_contact: snap.do_not_contact })
      .eq('person_id', snap.person_id);
    if (error) throw new Error(`could not restore ${snap.person_id}: ${error.message}`);
  }
  touched.clear();
});

async function selectTwo(page: Page): Promise<string[]> {
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  await expect
    .poll(
      async () =>
        (
          await rows.evaluateAll((els) =>
            els.map((el) => el.getAttribute('data-row-key') ?? '').filter(Boolean),
          )
        ).length,
      { timeout: 25000 },
    )
    .toBeGreaterThanOrEqual(2);

  const allKeys = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-row-key') ?? '').filter(Boolean),
  );
  const keys = allKeys.slice(0, 2);
  expect(keys).toHaveLength(2);
  await remember(keys);
  for (const key of keys) {
    await page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`).check();
  }
  return keys;
}

async function reselect(page: Page, keys: string[]) {
  for (const key of keys) {
    const box = page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`);
    await expect(box).toBeVisible({ timeout: 20000 });
    await box.check();
  }
}

test.describe('Q1: bulk actions on the candidate list', () => {
  test('the buttons are disabled until something is selected', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

    const status = page.getByRole('button', { name: 'Change Main Status to…' });
    await expect(status).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Mark as…' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send Email' })).toBeDisabled();

    await selectTwo(page);
    await expect(status).toBeEnabled();
  });

  test('changing the main status of two candidates writes both and logs both', async ({ page }) => {
    const admin = await clientAs('admin');
    const { data: statuses } = await admin
      .from('candidate_statuses')
      .select('id, label')
      .order('sort_order');

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const keys = await selectTwo(page);

    const current = new Set(keys.map((key) => touched.get(key)?.status_id));
    const target = statuses?.find((s) => !current.has(s.id));
    expect(target, 'need a status neither candidate already has').toBeTruthy();
    const since = new Date(Date.now() - 60000).toISOString();

    await page.getByRole('button', { name: 'Change Main Status to…' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Change the main status of 2 candidates');
    await chooseOption(page, dialog.getByRole('combobox', { name: 'Main status' }), target!.label);
    await dialog.getByRole('button', { name: /^Set to / }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const { data: rows } = await admin
      .from('candidate_profiles')
      .select('person_id, status_id')
      .in('person_id', keys);
    expect(rows?.length).toBe(2);
    expect(rows?.every((r) => r.status_id === target!.id)).toBe(true);

    const { data: activities, error } = await admin
      .from('activities')
      .select('person_id, kind, body')
      .eq('kind', 'status_change')
      .eq('body', target!.label)
      .in('person_id', keys)
      .gte('occurred_at', since);
    expect(error, error?.message).toBeNull();
    expect(
      new Set((activities ?? []).map((a) => a.person_id)).size,
      'the trigger logs one status_change per candidate, not one per statement',
    ).toBe(2);
  });

  test('marking do not contact takes those candidates out of a bulk email', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const keys = await selectTwo(page);

    await page.getByRole('button', { name: 'Mark as…' }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Mark 2 candidates');
    await dialog.getByRole('button', { name: 'Mark do not contact' }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const admin = await clientAs('admin');
    const { data: flagged } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .in('person_id', keys);
    expect(flagged?.every((r) => r.do_not_contact)).toBe(true);

    await reselect(page, keys);
    await page.getByRole('button', { name: 'Send Email' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Not emailed');
    await expect(dialog).toContainText('marked do not contact');
    await expect(dialog.getByRole('button', { name: 'Send to 0' })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await reselect(page, keys);
    await page.getByRole('button', { name: 'Mark as…' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Contactable again' }).check();
    await dialog.getByRole('button', { name: 'Clear do not contact' }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const { data: cleared } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .in('person_id', keys);
    expect(cleared?.every((r) => !r.do_not_contact)).toBe(true);
  });

  test('a sourcer cannot change candidates in bulk', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    await page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]').check();

    const status = page.getByRole('button', { name: 'Change Main Status to…' });
    await expect(status).toBeDisabled();
    await expect(status).toHaveAttribute(
      'title',
      'Only an admin or a recruiter can change candidates in bulk',
    );
  });
});
