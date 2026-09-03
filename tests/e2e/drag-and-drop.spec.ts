import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { PERSONA_EMAILS, expandSection, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const DEAL_NAME = `QA Drag Deal ${RUN}`;
const REQ_TITLE = `QA Drag Req ${RUN}`;

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

async function dragTo(page: Page, card: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('could not measure the drag source or target');

  const viewport = page.viewportSize();
  if (viewport) {
    const offscreen = [
      ['source', from.x + from.width / 2],
      ['target', to.x + to.width / 2],
    ].filter(([, centre]) => (centre as number) < 0 || (centre as number) > viewport.width);
    if (offscreen.length > 0) {
      throw new Error(
        `cannot drag: ${offscreen
          .map(([what, centre]) => `${what} centre at x=${Math.round(centre as number)}`)
          .join(', ')} is outside the ${viewport.width}px viewport, so the board needs scrolling between the two columns`,
      );
    }
  }

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();

  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 4, { steps: 5 });
  await page.mouse.up();
}

test.describe.configure({ mode: 'serial' });

test.describe('Drag and drop persists the stage (criteria 2.6 and 3.3)', () => {
  test('3.3 dragging a deal card to another stage column writes the new stage', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    let companyId: string | null = null;
    let dealId: string | null = null;

    try {
      const { data: co } = await admin
        .from('companies')
        .insert({ name: `QA Drag Co ${RUN}`, types: ['client'], is_test: true })
        .select('id')
        .single();
      companyId = co!.id;

      const { data: deal, error } = await admin
        .from('deals')
        .insert({ name: DEAL_NAME, company_id: companyId, stage: 'lead', value: 1000, is_test: true })
        .select('id')
        .single();
      expect(error).toBeNull();
      dealId = deal!.id;

      await signIn(page, PERSONA_EMAILS.bd);
      await gotoAsSignedIn(page, '/sales/deals');

      const card = page.locator('.sales-kanban-card', { hasText: DEAL_NAME });
      await expect(card).toHaveCount(1, { timeout: 25000 });

      const qualifiedCol = page.locator('.kanban-col', { hasText: /Qualified/i }).first();
      await expect(qualifiedCol).toBeVisible();

      await dragTo(page, card.first(), qualifiedCol);

      await expect
        .poll(
          async () => {
            const { data } = await admin.from('deals').select('stage').eq('id', dealId!);
            return data?.[0]?.stage ?? null;
          },
          { timeout: 25000, message: 'the drag should persist the new stage' },
        )
        .toBe('qualified');

      await expect(qualifiedCol.locator('.sales-kanban-card', { hasText: DEAL_NAME })).toHaveCount(
        1,
        { timeout: 20000 },
      );

      await page.reload();
      await expect(
        page.locator('.kanban-col', { hasText: /Qualified/i })
          .first()
          .locator('.sales-kanban-card', { hasText: DEAL_NAME }),
      ).toHaveCount(1, { timeout: 25000 });

      const { data: outbox } = await admin
        .from('events_outbox')
        .select('event_name')
        .eq('aggregate_id', dealId!)
        .eq('event_name', 'deal.stage_changed');
      expect(outbox?.length ?? 0).toBeGreaterThan(0);
    } finally {
      if (dealId) await admin.from('deals').delete().eq('id', dealId);
      if (companyId) await admin.from('companies').delete().eq('id', companyId);
    }
  });

  test('2.6 dragging a candidate card to another pipeline stage writes stage, audit and activity', async ({
    page,
  }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    let reqId: string | null = null;
    let personId: string | null = null;
    let appId: string | null = null;

    try {
      const { data: req } = await admin
        .from('requisitions')
        .insert({ title: REQ_TITLE, status: 'open', is_test: true })
        .select('id')
        .single();
      reqId = req!.id;

      const { data: person } = await admin
        .from('people')
        .insert({ first_name: 'Qa', last_name: `DragProbe${RUN}`, is_test: true })
        .select('id')
        .single();
      personId = person!.id;
      await admin.from('candidate_profiles').insert({ person_id: personId });

      const { data: app } = await admin
        .from('applications')
        .insert({ requisition_id: reqId, person_id: personId, stage: 'received' })
        .select('id')
        .single();
      appId = app!.id;

      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, `/recruit/requisitions/${reqId}`);

      const pipeline = await expandSection(page, 'Application Pipeline');
      await expect(pipeline).toBeVisible({ timeout: 25000 });
      await expect(page.getByText(`DragProbe${RUN}`).first()).toBeVisible({ timeout: 25000 });

      await page.getByRole('tab', { name: /^Kanban$/ }).first().click();

      const card = page.locator('.kanban-card', { hasText: `DragProbe${RUN}` });
      await expect(card).toHaveCount(1, { timeout: 25000 });

      const screeningCol = page.locator('.kanban-col', { hasText: 'screening' }).first();
      await expect(screeningCol).toBeVisible();

      await dragTo(page, card.first(), screeningCol);

      await expect
        .poll(
          async () => {
            const { data } = await admin.from('applications').select('stage').eq('id', appId!);
            return data?.[0]?.stage ?? null;
          },
          { timeout: 25000, message: 'the drag should persist the new pipeline stage' },
        )
        .toBe('screening');

      const { data: audit } = await admin
        .from('audit_log')
        .select('id')
        .eq('table_name', 'applications')
        .eq('record_id', appId!)
        .eq('action', 'update');
      expect(audit?.length ?? 0).toBeGreaterThan(0);

      const { data: activity } = await admin
        .from('activities')
        .select('id, kind')
        .eq('application_id', appId!)
        .eq('kind', 'status_change');
      expect(activity?.length ?? 0).toBeGreaterThan(0);

      const { data: events } = await admin
        .from('events_outbox')
        .select('event_name')
        .eq('aggregate_id', appId!)
        .eq('event_name', 'application.stage_changed');
      expect(events?.length ?? 0).toBeGreaterThan(0);
    } finally {
      if (appId) await admin.from('activities').delete().eq('application_id', appId);
      if (appId) await admin.from('applications').delete().eq('id', appId);
      if (personId) {
        await admin.from('candidate_profiles').delete().eq('person_id', personId);
        await admin.from('people').delete().eq('id', personId);
      }
      if (reqId) await admin.from('requisitions').delete().eq('id', reqId);
    }
  });
});
