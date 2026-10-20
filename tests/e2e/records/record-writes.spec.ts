import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import {
  PERSONA_EMAILS,
  expandSection,
  gotoAsSignedIn,
  localDateTimeValue,
  recordSection,
  overflowItem,
  signIn,
} from '../../support/e2e-helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const CANDIDATE = 'b0000000-0000-4000-8000-000000000002';
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

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

const WRITE_TAG = `QA RecWrite ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

async function cleanupWrites() {
  const admin = await apiAs(PERSONA_EMAILS.admin);
  await admin.from('activities').delete().ilike('subject', `${WRITE_TAG}%`);
  await admin.from('tasks').delete().ilike('subject', `${WRITE_TAG}%`);
  await admin.from('reminders').delete().ilike('subject', `${WRITE_TAG}%`);
}

test.describe('Record write paths (criteria 2.4, 2.5, 3.2)', () => {
  test.beforeEach(cleanupWrites);
  test.afterEach(cleanupWrites);
  test('2.4b a note can be edited and then deleted from a candidate record, and the edit survives a reload', async ({
    page,
  }) => {
    const subject = `${WRITE_TAG} edit ${Date.now()}`;
    const edited = `${subject} edited`;
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const stored = async (text: string) => {
      const { data } = await admin
        .from('activities')
        .select('subject, body')
        .eq('person_id', CANDIDATE)
        .eq('subject', text);
      return data ?? [];
    };

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);
    const log = await expandSection(page, 'Contact Log');
    await expect(log).toBeVisible({ timeout: 20000 });

    await log.getByLabel(/new note/i).fill(subject);
    await log.getByLabel(/note details/i).fill('before');
    await log.getByRole('button', { name: 'Log note', exact: true }).click();
    await expect(log.getByText(subject, { exact: true })).toBeVisible({ timeout: 20000 });

    await log.getByRole('button', { name: 'Edit this note' }).first().click();
    await log.getByLabel('Edit note subject').fill(edited);
    await log.getByLabel('Edit note details').fill('after');
    await log.getByRole('button', { name: 'Save note' }).click();
    await expect(log.getByText(edited, { exact: true })).toBeVisible({ timeout: 20000 });

    await expect.poll(() => stored(edited), { timeout: 20000 }).toEqual([
      { subject: edited, body: 'after' },
    ]);
    expect(await stored(subject)).toEqual([]);

    await page.reload();
    const reloaded = await expandSection(page, 'Contact Log');
    await expect(reloaded.getByText(edited, { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(reloaded.getByText('after', { exact: true })).toBeVisible();

    await reloaded.getByRole('button', { name: 'Delete this note' }).first().click();
    await page.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(reloaded.getByText(edited, { exact: true })).toHaveCount(0);
    await expect.poll(() => stored(edited), { timeout: 20000 }).toEqual([]);
  });

  test('2.4 logging a note from a candidate record writes it and shows it in the timeline', async ({
    page,
  }) => {
    const subject = `${WRITE_TAG} note ${Date.now()}`;
    const admin = await apiAs(PERSONA_EMAILS.admin);

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);

    const log = await expandSection(page, 'Contact Log');
    await expect(log).toBeVisible({ timeout: 20000 });

    await log.getByLabel(/new note/i).fill(subject);
    await log.getByLabel(/note details/i).fill('Written by the automated record-write test.');
    const submit = log.getByRole('button', { name: 'Log note', exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(log.getByText(subject)).toBeVisible({ timeout: 20000 });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('activities')
            .select('kind, person_id')
            .eq('subject', subject);
          return data?.[0] ?? null;
        },
        { timeout: 20000, message: 'the note should be written against the candidate' },
      )
      .toEqual({ kind: 'note', person_id: CANDIDATE });

    const timeline = page.locator('.record-section', { hasText: 'History Log' }).first();
    await timeline.getByRole('button', { name: /History Log/ }).click().catch(() => undefined);
    await expect(page.locator('body')).toContainText(subject);

  });

  test('2.4 a task and a reminder created from the record land against that person', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const taskSubject = `${WRITE_TAG} task ${Date.now()}`;
    const remSubject = `${WRITE_TAG} reminder ${Date.now()}`;

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);

    const tasks = await expandSection(page, 'Tasks');
    await tasks.getByLabel(/new task/i).fill(taskSubject);
    await tasks.getByRole('button', { name: /^Add task$/ }).click();
    await expect(tasks.getByText(taskSubject)).toBeVisible({ timeout: 20000 });

    const reminders = await expandSection(page, 'Reminders');
    await reminders.getByLabel(/new reminder/i).fill(remSubject);
    const when = reminders.locator('input[type="datetime-local"]').first();
    await when.fill(localDateTimeValue(3 * 86400_000));
    await reminders.getByRole('button', { name: /^Add reminder$/ }).click();
    await expect(reminders.getByText(remSubject)).toBeVisible({ timeout: 20000 });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('tasks')
            .select('related_type, related_id')
            .eq('subject', taskSubject);
          return data?.[0] ?? null;
        },
        { timeout: 20000, message: 'the task should be written against the candidate' },
      )
      .toEqual({ related_type: 'person', related_id: CANDIDATE });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('reminders')
            .select('related_type, related_id, status')
            .eq('subject', remSubject);
          return data?.[0] ?? null;
        },
        { timeout: 20000, message: 'the reminder should be written against the candidate' },
      )
      .toEqual({ related_type: 'person', related_id: CANDIDATE, status: 'pending' });

  });

  test('2.5 the newest resume is the one marked Current', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const stamp = Date.now();
    const older = `person/${CANDIDATE}/qa-older-${stamp}.pdf`;
    const newer = `person/${CANDIDATE}/qa-newer-${stamp}.pdf`;
    const made: string[] = [];

    for (const [path, uploadedAt] of [
      [older, new Date(stamp - 7 * 86400000).toISOString()],
      [newer, new Date(stamp).toISOString()],
    ] as const) {
      const up = await admin.storage
        .from('attachments')
        .upload(path, new Blob([PDF], { type: 'application/pdf' }));
      expect(up.error).toBeNull();
      const { data, error } = await admin
        .from('attachments')
        .insert({
          storage_path: path,
          parent_type: 'person',
          parent_id: CANDIDATE,
          kind: 'resume',
          uploaded_at: uploadedAt,
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      made.push(data!.id);
    }

    try {
      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);

      const resumesSection = await expandSection(page, 'Resumes');
      await expect(resumesSection).toBeVisible({ timeout: 20000 });

      const newerItem = resumesSection.locator('.panel-item', { hasText: `qa-newer-${stamp}` });
      const olderItem = resumesSection.locator('.panel-item', { hasText: `qa-older-${stamp}` });
      await expect(newerItem).toHaveCount(1, { timeout: 20000 });
      await expect(olderItem).toHaveCount(1);
      await expect(newerItem).toContainText('Current');
      await expect(olderItem).not.toContainText('Current');
      await expect(resumesSection.locator('.panel-item', { hasText: 'Current' })).toHaveCount(1);

      await expect(
        recordSection(page, 'Resume Preview'),
        'the Resume Preview accordion was removed on 2026-09-10: the action bar already opens the current resume, and the accordion rendered the same file a second time',
      ).toHaveCount(0);
      await expect(
        await overflowItem(page, 'View Resume'),
        'and that control is the surface it was replaced by, now in the overflow menu',
      ).toBeEnabled();
    } finally {
      await admin.storage.from('attachments').remove([older, newer]);
      for (const id of made) await admin.from('attachments').delete().eq('id', id);
    }
  });

  test('3.2 a contact record quick-add writes a note against the contact', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const subject = `${WRITE_TAG} contact note ${Date.now()}`;

    await signIn(page, PERSONA_EMAILS.bd);
    await gotoAsSignedIn(page, '/sales/contacts');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/sales\/contacts\/[0-9a-f-]{36}/);
    const personId = page.url().split('/').pop()!;

    await page.getByRole('button', { name: 'Note', exact: true }).click();
    const dialog = page.locator('[role="dialog"], .modal, .fo-modal').first();
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await dialog.getByLabel(/^Subject/).fill(subject);
    await dialog.getByLabel(/^Details/).fill('Written by the automated contact-write test.');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    await expect(dialog).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.sales-panel-item-title', { hasText: subject })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.locator('.timeline-subject', { hasText: subject })).toBeVisible({
      timeout: 20000,
    });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('activities')
            .select('kind, person_id')
            .eq('subject', subject);
          return data?.[0] ?? null;
        },
        { timeout: 20000, message: 'the contact note should be written against the contact' },
      )
      .toEqual({ kind: 'note', person_id: personId });

  });
});
