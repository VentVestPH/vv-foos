import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const DEAL = 'e0000000-0000-4000-8000-000000000001';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const MARKER = `timeline-cap ${RUN}`;
const SEEDED_HISTORY = 120;

test.describe('T2: the activity timeline is capped', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const admin = await clientAs('admin');
    const rows = Array.from({ length: SEEDED_HISTORY }, (_, i) => ({
      kind: 'note' as const,
      subject: `${MARKER} #${i}`,
      body: 'Fixture entry for the timeline cap test.',
      deal_id: DEAL,
      occurred_at: new Date(Date.now() - i * 60_000).toISOString(),
    }));
    const { error } = await admin.from('activities').insert(rows);
    if (error) throw new Error(`could not seed the timeline fixture: ${error.message}`);
  });

  test.afterAll(async () => {
    const admin = await clientAs('admin');
    const { error } = await admin.from('activities').delete().like('subject', `${MARKER}%`);
    if (error) throw new Error(`could not remove the timeline fixture: ${error.message}`);
    const { count } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .like('subject', `${MARKER}%`);
    if ((count ?? 0) > 0) {
      throw new Error(`${count} timeline fixture row(s) survived teardown`);
    }
  });

  test('a long history renders 50 entries with a control for the rest', async ({ page }) => {
    const admin = await clientAs('admin');
    const { count } = await admin
      .from('activities')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', DEAL);
    const total = count ?? 0;
    expect(
      total,
      'the fixture inserts its own long history, so this should never be short',
    ).toBeGreaterThan(60);

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/sales/deals/${DEAL}`);

    const items = page.locator('.timeline-item');
    await expect(items.first()).toBeVisible({ timeout: 25000 });
    expect(await items.count(), 'the timeline must not render everything at once').toBe(50);

    const more = page.locator('.timeline-more');
    await expect(more).toContainText(`Showing 50 of ${total}`);

    await more.getByRole('button').click();
    await expect.poll(() => items.count(), { timeout: 5000 }).toBe(Math.min(150, total));
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
