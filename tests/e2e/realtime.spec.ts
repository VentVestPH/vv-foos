import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RECRUITER_STAFF_ID = 'a0000000-0000-4000-8000-000000000002';

async function apiAs(email: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

test.describe('Live updates without a reload (criterion 2.2)', () => {
  test('the unviewed badge decrements when a view is recorded elsewhere', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);

    await admin.from('application_views').delete().eq('staff_id', RECRUITER_STAFF_ID);

    const { data: apps, error: appsErr } = await admin
      .from('applications')
      .select('id, requisition_id')
      .limit(50);
    expect(appsErr).toBeNull();
    expect((apps ?? []).length).toBeGreaterThan(0);

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/requisitions');

    const badges = page.locator('.unviewed-badge');
    await expect(badges.first()).toBeVisible({ timeout: 20000 });

    const readTotal = async () => {
      const texts = await badges.allInnerTexts();
      return texts.reduce((sum, t) => sum + (Number(/(\d+)/.exec(t)?.[1] ?? 0) || 0), 0);
    };
    const before = await readTotal();
    expect(before).toBeGreaterThan(0);

    const recruiter = await apiAs(PERSONA_EMAILS.recruiter);
    const { error: viewErr } = await recruiter.from('application_views').upsert({
      application_id: apps![0].id,
      staff_id: RECRUITER_STAFF_ID,
      last_viewed_at: new Date().toISOString(),
    });
    expect(viewErr).toBeNull();

    await expect
      .poll(readTotal, { timeout: 25000, message: 'unviewed total should drop without a reload' })
      .toBeLessThan(before);

    await admin.from('application_views').delete().eq('staff_id', RECRUITER_STAFF_ID);
  });
});
