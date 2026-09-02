import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const DEAL = 'e0000000-0000-4000-8000-000000000001';

test.describe('T2: the activity timeline is capped', () => {
  test('a long history renders 50 entries with a control for the rest', async ({ page }) => {
    const admin = await clientAs('admin');
    const { count } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', DEAL);
    expect(count ?? 0, 'this fixture needs a long history to be meaningful').toBeGreaterThan(60);

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/sales/deals/${DEAL}`);

    const items = page.locator('.timeline-item');
    await expect(items.first()).toBeVisible({ timeout: 25000 });
    expect(await items.count(), 'the timeline must not render everything at once').toBe(50);

    const more = page.locator('.timeline-more');
    await expect(more).toContainText(`Showing 50 of ${count}`);

    await more.getByRole('button').click();
    await expect
      .poll(() => items.count(), { timeout: 5000 })
      .toBe(Math.min(150, count ?? 0));
  });

  test('a short history shows no control at all', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates/b0000000-0000-4000-8000-000000000002');
    const section = page
      .locator('.record-section')
      .filter({ hasText: /Contact Log|Activity|Timeline/ })
      .first();
    if (!(await section.count())) return;
    await expect(page.locator('.timeline-more')).toHaveCount(0);
  });
});
