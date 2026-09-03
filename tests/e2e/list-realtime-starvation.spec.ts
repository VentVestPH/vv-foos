import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const RESPONSE_DELAY_MS = 2000;
const CHURN_GAP_MS = 300;
const CHURN_WINDOW_MS = 25000;
const PAINT_BUDGET_MS = 15000;

test.describe('a list still paints while its own table is being written to', () => {
  test('the candidate list is not starved by a trickle of candidate_profiles changes', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const admin = await clientAs('admin');
    let personId = '';
    let live = true;
    let writes = 0;
    let churn: Promise<void> = Promise.resolve();

    try {
      const { data: person, error: personErr } = await admin
        .from('people')
        .insert({ first_name: 'Qa', last_name: `ChurnProbe${RUN}`, is_test: true })
        .select('id')
        .single();
      if (personErr) throw personErr;
      personId = person.id;
      const { error: profErr } = await admin
        .from('candidate_profiles')
        .insert({ person_id: personId });
      if (profErr) throw profErr;

      await page.route(/rest\/v1\/candidate_list/, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS));
        await route.continue();
      });

      churn = (async () => {
        const until = Date.now() + CHURN_WINDOW_MS;
        while (live && Date.now() < until) {
          const { error } = await admin
            .from('candidate_profiles')
            .update({ grade_comment: `churn ${writes}` })
            .eq('person_id', personId);
          if (error) throw new Error(`the churn write failed: ${error.message}`);
          writes += 1;
          await new Promise((resolve) => setTimeout(resolve, CHURN_GAP_MS));
        }
      })();

      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, '/recruit/candidates');

      await expect(
        page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').first(),
        'every candidate_list response is delayed past the gap between changes, so without ' +
          'coalescing each change restarts the load and no response is ever the newest when ' +
          'it lands: the table stays empty with no error and nothing triggers another load',
      ).toBeVisible({ timeout: PAINT_BUDGET_MS });

      expect(
        writes,
        'the churn must still have been running when the list painted, or this proves nothing',
      ).toBeGreaterThan(2);
      expect(live, 'the churn window must outlast the paint budget').toBe(true);
    } finally {
      live = false;
      await churn.catch(() => undefined);
      if (personId) {
        const prof = await admin.from('candidate_profiles').delete().eq('person_id', personId);
        if (prof.error) throw new Error(`could not remove the churn profile: ${prof.error.message}`);
        const { error } = await admin.from('people').delete().eq('id', personId);
        if (error) throw new Error(`could not remove the churn person: ${error.message}`);
        const { data } = await admin.from('people').select('id').eq('id', personId);
        if (data?.length) throw new Error(`the churn fixture ${personId} survived its teardown`);
      }
    }
  });
});
