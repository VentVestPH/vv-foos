import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn, waitForRealtime } from './helpers';

test.describe('the dashboard survives being remounted', () => {
  test('switching tabs does not rebind a realtime channel that is already joined', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const admin = await clientAs('admin');
    const startedAt = new Date().toISOString();
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/');
    await waitForRealtime(page);

    const tabs = ['/?tab=pipeline', '/', '/?tab=reports', '/?tab=pipeline', '/'];
    for (let round = 0; round < 4; round += 1) {
      for (const tab of tabs) {
        await page.goto(tab);
        await page.waitForTimeout(120);
      }
    }
    await page.waitForTimeout(1500);
    await expect(page.locator('[role="alert"].error-boundary')).toHaveCount(0);

    const rebinding = pageErrors.filter((m) => m.includes('postgres_changes'));
    expect(rebinding, `the page threw while rebinding a realtime channel: ${rebinding[0] ?? ''}`)
      .toHaveLength(0);

    const { data, error } = await admin
      .from('client_errors')
      .select('id, message, route')
      .gte('occurred_at', startedAt);
    if (error) throw new Error(`could not read client_errors: ${error.message}`);
    const recorded = data ?? [];
    if (recorded.length > 0) {
      const ids = recorded.map((r) => r.id);
      const del = await admin.from('client_errors').delete().in('id', ids);
      if (del.error) throw new Error(`could not clear client_errors: ${del.error.message}`);
    }
    expect(
      recorded.map((r) => `${r.route ?? '-'}: ${r.message}`),
      'the dashboard reported a client error while switching tabs',
    ).toEqual([]);
  });
});
