import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

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

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/');

    const intakeTab = page.getByRole('button', { name: /^Intake/ });
    const badge = intakeTab.locator('.fo-nav-badge');
    await expect
      .poll(
        async () => {
          const { count } = await admin
            .from('intake_items')
            .select('id', { count: 'exact', head: true })
            .not('status', 'in', '("imported","rejected")');
          const shown = Number(/^\d+/.exec((await badge.textContent()) ?? '')?.[0] ?? NaN);
          return shown === count;
        },
        {
          timeout: 20000,
          message: 'the badge settles on the live count of unsettled items, which other workers may be changing',
        },
      )
      .toBe(true);
    await expect(intakeTab).toHaveAttribute('title', /awaiting review/);
  });
});
