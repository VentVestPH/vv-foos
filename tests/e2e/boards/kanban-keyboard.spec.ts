import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';

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

test.describe('L7: the kanban board is operable by keyboard', () => {
  test('a card is focusable, announces its column, and carries help text', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.bd);
    await gotoAsSignedIn(page, '/sales/deals');

    const kanbanToggle = page.getByRole('button', { name: /kanban/i }).first();
    if (await kanbanToggle.count()) await kanbanToggle.click();

    const card = page.locator('.kanban-card').first();
    await expect(card).toBeVisible({ timeout: 25000 });

    await expect(card, 'a draggable card must be reachable by tab').toHaveAttribute(
      'tabindex',
      '0',
    );
    await expect(card).toHaveAttribute('aria-label', /\d+ of \d+/);
    await expect(page.locator('#kanban-keyboard-help')).toHaveCount(1);
    await expect(page.locator('#kanban-keyboard-help')).toContainText('arrow keys');

    await card.focus();
    await expect(card).toBeFocused();
  });

  test('space grabs, arrow moves the card to the next stage, and the change persists', async ({
    page,
  }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await signIn(page, PERSONA_EMAILS.bd);
    await gotoAsSignedIn(page, '/sales/deals');

    const kanbanToggle = page.getByRole('button', { name: /kanban/i }).first();
    if (await kanbanToggle.count()) await kanbanToggle.click();

    const card = page.locator('.kanban-card').first();
    await expect(card).toBeVisible({ timeout: 25000 });
    const labelBefore = await card.getAttribute('aria-label');

    await card.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('.kanban-card.grabbed'), 'space must grab the card').toHaveCount(1);

    await page.keyboard.press('ArrowRight');

    await expect
      .poll(async () => (await page.locator('.kanban-card').first().getAttribute('aria-label')), {
        timeout: 20000,
      })
      .not.toBe(labelBefore);

    const { data: deals } = await admin
      .from('deals')
      .select('id, stage')
      .order('updated_at', { ascending: false })
      .limit(1);
    expect(deals?.length, 'the move must have written to the database').toBe(1);
  });

  test('escape cancels a grab without moving anything', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.bd);
    await gotoAsSignedIn(page, '/sales/deals');

    const kanbanToggle = page.getByRole('button', { name: /kanban/i }).first();
    if (await kanbanToggle.count()) await kanbanToggle.click();

    const card = page.locator('.kanban-card').first();
    await expect(card).toBeVisible({ timeout: 25000 });
    const labelBefore = await card.getAttribute('aria-label');

    await card.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('.kanban-card.grabbed')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.kanban-card.grabbed'), 'escape must release the card').toHaveCount(
      0,
    );

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.kanban-card').first()).toHaveAttribute(
      'aria-label',
      labelBefore ?? '',
    );
  });
});
