import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const VIEW_NAME = `QA Saved View ${RUN}`;
const PENDING_NAME = '…';

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

test.describe.configure({ mode: 'serial' });

test.describe('List persistence and export (criteria 2.9 and 2.11)', () => {
  test.afterEach(async () => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await admin.from('ats_saved_views').delete().ilike('name', `QA Saved View ${RUN}%`);
  });

  test('2.9 a saved view survives a completely new browser session', async ({ browser }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await admin.from('ats_saved_views').delete().ilike('name', `QA Saved View ${RUN}%`);

    const first = await browser.newContext();
    const page = await first.newPage();
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    const dialog = page.locator('[role="dialog"], .modal, .taleo-modal').first();
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await dialog.getByLabel(/^View name/).fill(VIEW_NAME);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20000 });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('ats_saved_views')
            .select('id, entity, staff_id')
            .eq('name', VIEW_NAME);
          return data?.length ?? 0;
        },
        { timeout: 20000, message: 'the saved view should be persisted server-side' },
      )
      .toBe(1);

    await first.close();

    const second = await browser.newContext();
    const page2 = await second.newPage();
    await signIn(page2, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page2, '/recruit/candidates');

    const savedViewSelect = page2.locator('select').filter({ hasText: VIEW_NAME });
    await expect(savedViewSelect, 'the saved view should be offered in a new session').toHaveCount(
      1,
      { timeout: 25000 },
    );
    await expect(savedViewSelect.locator('option', { hasText: VIEW_NAME })).toHaveCount(1);
    await second.close();
  });

  test('2.9 another staff member does not see that saved view', async ({ browser }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const { error } = await admin.from('ats_saved_views').insert({
      name: VIEW_NAME,
      entity: 'candidate',
      staff_id: 'a0000000-0000-4000-8000-000000000002',
      filters: {},
    });
    expect(error).toBeNull();

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.filter-rail')).toBeVisible({ timeout: 25000 });
    await expect(page.locator('option', { hasText: VIEW_NAME })).toHaveCount(0);
    await context.close();
  });

  test('2.11 the CSV export matches the filtered set on screen', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 25000 });

    await expect
      .poll(
        async () =>
          (await rows.locator('.link-btn').allInnerTexts()).filter(
            (t) => t.trim() === PENDING_NAME,
          ).length,
        { timeout: 25000, message: 'candidate names are still resolving' },
      )
      .toBe(0);

    const onScreen: string[] = [];
    for (const row of await rows.all()) {
      const name = (await row.locator('.link-btn').first().innerText()).trim();
      if (name) onScreen.push(name);
    }
    expect(onScreen.length).toBeGreaterThan(0);

    const download = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
    ]).then(([d]) => d);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf8');

    const lines = csv.trim().split(/\r?\n/);
    expect(lines.length, 'a header plus one line per visible row').toBe(onScreen.length + 1);

    for (const name of onScreen) {
      expect(csv, `${name} is on screen but missing from the export`).toContain(name);
    }
  });
});
