import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RECRUITER_STAFF_ID = 'a0000000-0000-4000-8000-000000000002';
const TAG = `QA TaskBoard ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

async function cleanup() {
  const recruiter = await apiAs(PERSONA_EMAILS.recruiter);
  await recruiter.from('tasks').delete().eq('assignee_id', RECRUITER_STAFF_ID).ilike('subject', `${TAG}%`);
}

test.describe.configure({ mode: 'serial' });

test.describe('FOOSCR-5: My Task Board on the dashboard', () => {
  test.beforeEach(cleanup);
  test.afterEach(cleanup);

  test('a task moves between columns from the keyboard and the status persists after a reload', async ({ page }) => {
    const subject = `${TAG} card`;
    const recruiter = await apiAs(PERSONA_EMAILS.recruiter);
    const { error } = await recruiter
      .from('tasks')
      .insert({ subject, status: 'open', assignee_id: RECRUITER_STAFF_ID, due_date: '2000-01-01' });
    expect(error).toBeNull();
    const statusOf = async () => {
      const { data } = await recruiter.from('tasks').select('status').eq('subject', subject).single();
      return data?.status ?? null;
    };

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');

    const board = page.getByRole('group', { name: 'Stage board, scrollable' });
    const column = (name: string) =>
      board.locator('.kanban-col').filter({ has: page.locator('.kanban-col-header', { hasText: name }) });
    const card = (name: string) => column(name).locator('.kanban-card').filter({ hasText: subject });

    await expect(card('Backlog')).toBeVisible({ timeout: 20000 });

    await card('Backlog').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');

    await expect(card('In Progress')).toBeVisible();
    await expect(card('Backlog')).toHaveCount(0);
    await expect.poll(statusOf, { timeout: 20000 }).toBe('in_progress');

    await page.reload();
    await expect(card('In Progress')).toBeVisible({ timeout: 20000 });
    await expect(card('Backlog')).toHaveCount(0);
  });

  test('a cancelled task shows in Cancelled and drops out of the My Tasks list', async ({ page }) => {
    const subject = `${TAG} cancelled`;
    const recruiter = await apiAs(PERSONA_EMAILS.recruiter);
    const { error } = await recruiter
      .from('tasks')
      .insert({ subject, status: 'cancelled', assignee_id: RECRUITER_STAFF_ID });
    expect(error).toBeNull();

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');

    const cancelled = page
      .getByRole('group', { name: 'Stage board, scrollable' })
      .locator('.kanban-col')
      .filter({ has: page.locator('.kanban-col-header', { hasText: 'Cancelled' }) });
    await expect(cancelled.locator('.kanban-card').filter({ hasText: subject })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.task-list').getByText(subject)).toHaveCount(0);
  });
});
