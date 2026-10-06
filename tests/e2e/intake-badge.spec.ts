import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const PROBE_NAME = 'E2E Intake Badge Probe';

async function adminClient() {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email: PERSONA_EMAILS.admin,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

test.describe('Intake badge (D17)', () => {
  test.afterAll(async () => {
    const admin = await adminClient();
    await admin.from('intake_items').delete().eq('full_name', PROBE_NAME);
  });

  test('the Intake nav item shows a live count of items awaiting review', async ({ page }) => {
    const admin = await adminClient();
    await admin.from('intake_items').delete().eq('full_name', PROBE_NAME);
    const { error } = await admin
      .from('intake_items')
      .insert({ channel: 'manual', target_type: 'candidate', full_name: PROBE_NAME, status: 'pending' });
    expect(error).toBeNull();

    const { count } = await admin
      .from('intake_items')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'parsed']);

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/');

    const intakeTab = page.getByRole('button', { name: /^Intake/ });
    await expect(intakeTab.locator('.fo-nav-badge')).toHaveText(new RegExp(`^${count}`), {
      timeout: 15000,
    });
    await expect(intakeTab).toHaveAttribute('title', /awaiting review/);
  });
});
