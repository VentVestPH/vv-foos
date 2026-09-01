import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn, waitForRealtime } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RECRUITER_STAFF_ID = 'a0000000-0000-4000-8000-000000000002';
const TAG = `QA Realtime Req ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

test.describe('Live updates without a reload (criterion 2.2)', () => {
  test('the unviewed badge on a requisition clears when a view is recorded elsewhere', async ({
    page,
  }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const title = `${TAG} ${Date.now()}`;
    let reqId: string | null = null;
    let personId: string | null = null;
    let appId: string | null = null;

    try {
      const { data: req, error: reqErr } = await admin
        .from('requisitions')
        .insert({ title, status: 'open', is_test: true })
        .select('id')
        .single();
      expect(reqErr).toBeNull();
      reqId = req!.id;

      const { data: person } = await admin
        .from('people')
        .insert({ first_name: 'Qa', last_name: 'RealtimeProbe', is_test: true })
        .select('id')
        .single();
      personId = person!.id;

      const { data: app } = await admin
        .from('applications')
        .insert({ requisition_id: reqId, person_id: personId, stage: 'received' })
        .select('id')
        .single();
      appId = app!.id;

      await admin
        .from('application_views')
        .delete()
        .eq('application_id', appId)
        .eq('staff_id', RECRUITER_STAFF_ID);

      await signIn(page, PERSONA_EMAILS.recruiter);
      const realtimeReady = waitForRealtime(page);
      await gotoAsSignedIn(page, '/recruit/requisitions');
      await realtimeReady;

      const row = page.locator('.table-wrap tbody tr', { hasText: title });
      await expect(row).toHaveCount(1, { timeout: 25000 });
      await expect(row.locator('.unviewed-badge')).toHaveCount(1, { timeout: 25000 });
      await expect(row.locator('.unviewed-badge')).toContainText('1');

      const recruiter = await apiAs(PERSONA_EMAILS.recruiter);
      const recordView = async () =>
        recruiter.from('application_views').upsert({
          application_id: appId,
          staff_id: RECRUITER_STAFF_ID,
          last_viewed_at: new Date().toISOString(),
        });

      const { error: viewErr } = await recordView();
      expect(viewErr).toBeNull();

      await expect
        .poll(
          async () => {
            const gone = (await row.locator('.unviewed-badge').count()) === 0;
            if (!gone) await recordView();
            return gone;
          },
          { timeout: 30000, message: 'the badge should clear without a reload' },
        )
        .toBe(true);
    } finally {
      if (appId) await admin.from('application_views').delete().eq('application_id', appId);
      if (appId) await admin.from('applications').delete().eq('id', appId);
      if (personId) await admin.from('people').delete().eq('id', personId);
      if (reqId) await admin.from('requisitions').delete().eq('id', reqId);
    }
  });
});
