import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn, waitForRealtime } from '../../support/e2e-helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RECRUITER_STAFF_ID = 'a0000000-0000-4000-8000-000000000002';
const SEED_PERSON = 'b0000000-0000-4000-8000-000000000001';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const TAG = `QA RemTask Reminder ${RUN}`;
const TASK_TAG = `QA RemTask Task ${RUN}`;

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

async function cleanup(admin: SupabaseClient) {
  await admin.from('reminders').delete().ilike('subject', `${TAG}%`);
  await admin.from('tasks').delete().ilike('subject', `${TASK_TAG}%`);
}

test.describe.configure({ mode: 'serial' });

test.describe('QA-007: reminder.due and tasks have an interface', () => {
  test.beforeEach(async () => {
    await cleanup(await apiAs(PERSONA_EMAILS.admin));
  });

  test.afterEach(async () => {
    await cleanup(await apiAs(PERSONA_EMAILS.admin));
  });

  test('a fired reminder appears under Due now, links to its record, and dismisses', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await cleanup(admin);

    const { error: insErr } = await admin.from('reminders').insert({
      staff_id: RECRUITER_STAFF_ID,
      subject: `${TAG} overdue`,
      remind_at: new Date(Date.now() - 90 * 60000).toISOString(),
      related_type: 'person',
      related_id: SEED_PERSON,
      status: 'pending',
    });
    expect(insErr).toBeNull();

    const { data: fired, error: fireErr } = await admin.rpc('fn_fire_due_reminders');
    expect(fireErr).toBeNull();
    expect(Number(fired)).toBeGreaterThan(0);

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');

    const panel = page.locator('.reminders-panel');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.getByRole('heading', { name: /Due now/ })).toBeVisible();
    await expect(panel.getByText(`${TAG} overdue`)).toBeVisible();
    await expect(panel.locator('.reminder-row.is-due').first()).toBeVisible();

    await panel.getByRole('button', { name: `${TAG} overdue` }).click();
    await expect(page).toHaveURL(new RegExp(`/recruit/candidates/${SEED_PERSON}`));

    await gotoAsSignedIn(page, '/');
    const overdueRow = panel.locator('.reminder-row', { hasText: `${TAG} overdue` });
    await expect(overdueRow).toHaveCount(1, { timeout: 20000 });
    await overdueRow.getByRole('button', { name: 'Dismiss' }).click();
    await expect(overdueRow).toHaveCount(0, { timeout: 20000 });

    const { data: after } = await admin
      .from('reminders')
      .select('status')
      .ilike('subject', `${TAG}%`)
      .single();
    expect(after?.status).toBe('dismissed');
  });

  test('a reminder firing elsewhere reaches an open dashboard without a reload', async ({ page }) => {
    test.setTimeout(90000);
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await cleanup(admin);

    await signIn(page, PERSONA_EMAILS.recruiter);
    const realtimeReady = waitForRealtime(page);
    await gotoAsSignedIn(page, '/');
    const panel = page.locator('.reminders-panel');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.getByText(`${TAG} live`)).toHaveCount(0);
    await realtimeReady;

    const { error: insErr } = await admin.from('reminders').insert({
      staff_id: RECRUITER_STAFF_ID,
      subject: `${TAG} live`,
      remind_at: new Date(Date.now() - 60000).toISOString(),
      related_type: null,
      related_id: null,
      status: 'pending',
    });
    expect(insErr).toBeNull();

    const { error: fireErr } = await admin.rpc('fn_fire_due_reminders');
    expect(fireErr).toBeNull();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('reminders')
            .select('status')
            .eq('subject', `${TAG} live`);
          return data?.[0]?.status ?? null;
        },
        { timeout: 20000, message: 'the reminder should be marked fired before the UI can show it' },
      )
      .toBe('fired');

    const liveRow = panel.locator('.reminder-row', { hasText: `${TAG} live` });
    await expect
      .poll(() => liveRow.count(), {
        timeout: 45000,
        message:
          'the fired reminder should reach an open dashboard with no reload, ' +
          'either from the realtime event or from the 20s backstop refresh',
      })
      .toBe(1);
    await expect(panel.getByRole('heading', { name: /Due now/ })).toBeVisible();
  });

  test('an upcoming reminder shows under Upcoming, not Due now', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await cleanup(admin);

    await admin.from('reminders').insert({
      staff_id: RECRUITER_STAFF_ID,
      subject: `${TAG} future`,
      remind_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      status: 'pending',
    });

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');
    const panel = page.locator('.reminders-panel');
    await expect(panel.getByRole('heading', { name: /Upcoming/ })).toBeVisible({ timeout: 20000 });
    const futureRow = panel.locator('.reminder-row', { hasText: `${TAG} future` });
    await expect(futureRow).toHaveCount(1);
    await expect(futureRow).not.toHaveClass(/is-due/);
  });

  test('My Tasks lists open tasks with due dates and completes them', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await cleanup(admin);

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const { error } = await admin.from('tasks').insert({
      subject: `${TASK_TAG} overdue`,
      due_date: yesterday,
      priority: 'high',
      status: 'open',
      assignee_id: RECRUITER_STAFF_ID,
      related_type: 'person',
      related_id: SEED_PERSON,
    });
    expect(error).toBeNull();

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');

    const panel = page.locator('.tasks-panel');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.getByText(`${TASK_TAG} overdue`)).toBeVisible();
    await expect(panel.locator('.task-row.is-overdue').first()).toBeVisible();
    await expect(panel.locator('.task-due').first()).toContainText(/overdue/i);

    const taskRow = panel.locator('.task-row', { hasText: `${TASK_TAG} overdue` });
    await expect(taskRow).toHaveCount(1);
    await taskRow.getByRole('button', { name: 'Complete' }).click();
    await expect(taskRow).toHaveCount(0, { timeout: 20000 });

    const { data: after } = await admin
      .from('tasks')
      .select('status')
      .ilike('subject', `${TASK_TAG}%`)
      .single();
    expect(after?.status).toBe('done');
  });

  test('a recruiter sees only their own reminders', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await cleanup(admin);

    await admin.from('reminders').insert({
      staff_id: 'a0000000-0000-4000-8000-000000000003',
      subject: `${TAG} someone else`,
      remind_at: new Date(Date.now() - 60000).toISOString(),
      status: 'pending',
    });
    await admin.rpc('fn_fire_due_reminders');

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/');
    const panel = page.locator('.reminders-panel');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.getByText(`${TAG} someone else`)).toHaveCount(0);
  });

  test('F23: the reminder sweep only touches what the caller may already update', async () => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const sourcer = await apiAs(PERSONA_EMAILS.sourcer);
    await cleanup(admin);

    const { data: me } = await sourcer.auth.getUser();
    const sourcerId = me.user?.id;
    expect(sourcerId).toBeTruthy();

    const due = new Date(Date.now() - 60000).toISOString();
    const { error: insErr } = await admin.from('reminders').insert([
      { staff_id: RECRUITER_STAFF_ID, subject: `${TAG} someone elses`, remind_at: due, status: 'pending' },
      { staff_id: sourcerId, subject: `${TAG} the callers own`, remind_at: due, status: 'pending' },
    ]);
    expect(insErr).toBeNull();

    const { error: sweepErr } = await sourcer.rpc('fn_fire_due_reminders');
    expect(sweepErr).toBeNull();

    const { data: afterSourcer } = await admin
      .from('reminders')
      .select('subject, status')
      .ilike('subject', `${TAG}%`);
    const status = (suffix: string) =>
      afterSourcer?.find((r) => r.subject.endsWith(suffix))?.status;
    expect(status('the callers own'), 'a sourcer may fire their own due reminder').toBe('fired');
    expect(
      status('someone elses'),
      'a sourcer must not be able to fire a reminder belonging to someone else',
    ).toBe('pending');

    const { error: adminErr } = await admin.rpc('fn_fire_due_reminders');
    expect(adminErr).toBeNull();
    const { data: afterAdmin } = await admin
      .from('reminders')
      .select('status')
      .ilike('subject', `${TAG}%`);
    expect(
      afterAdmin?.every((r) => r.status === 'fired'),
      'an admin sweeps everything, matching the reminders_update policy',
    ).toBe(true);
  });
});
