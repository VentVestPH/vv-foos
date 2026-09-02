import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, expandSection, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const CANDIDATE = 'b0000000-0000-4000-8000-000000000002';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const PENDING_NAME = `QA Pending ${RUN}.pdf`;
const PENDING_PATH = `zoho-import/pending/${CANDIDATE}/${PENDING_NAME}`;

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
  const admin = await apiAs(PERSONA_EMAILS.admin);
  await admin.from('attachments').delete().eq('storage_path', PENDING_PATH);
}

test.describe.configure({ mode: 'serial' });

test.describe('D6: an imported attachment with no file bytes says so', () => {
  test.beforeAll(async () => {
    await cleanup();
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const { error } = await admin.from('attachments').insert({
      storage_path: PENDING_PATH,
      parent_type: 'person',
      parent_id: CANDIDATE,
      kind: 'other',
      description: PENDING_NAME,
    });
    expect(error, 'the placeholder attachment row should insert').toBeNull();
  });

  test.afterAll(cleanup);

  test('the file is listed, badged as unavailable, and is not a link', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);
    await expandSection(page, 'Attachments');

    const item = page.locator('.panel-item').filter({ hasText: PENDING_NAME }).first();
    await expect(item).toBeVisible({ timeout: 20000 });

    await expect(item.getByText('File not yet available')).toBeVisible();
    await expect(item.locator('.file-pending-name')).toHaveText(PENDING_NAME);
    await expect(item.locator('.link-btn')).toHaveCount(0);
  });

  test('a real uploaded file in the same list is still a working link', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const realPath = `person/${CANDIDATE}/${Date.now()}_qa-real-${RUN}.pdf`;
    const upload = await admin.storage
      .from('attachments')
      .upload(realPath, new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]), {
        contentType: 'application/pdf',
      });
    expect(upload.error).toBeNull();
    const { data: row, error } = await admin
      .from('attachments')
      .insert({
        storage_path: realPath,
        parent_type: 'person',
        parent_id: CANDIDATE,
        kind: 'other',
        description: `QA Real ${RUN}.pdf`,
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    try {
      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, `/recruit/candidates/${CANDIDATE}`);
      await expandSection(page, 'Attachments');

      const real = page.locator('.panel-item').filter({ hasText: `QA Real ${RUN}.pdf` }).first();
      await expect(real).toBeVisible({ timeout: 20000 });
      await expect(real.locator('.link-btn')).toHaveCount(1);
      await expect(real.getByText('File not yet available')).toHaveCount(0);
    } finally {
      await admin.storage.from('attachments').remove([realPath]);
      if (row) await admin.from('attachments').delete().eq('id', row.id);
    }
  });
});
