import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const BATCH = `QA-E2E-Intake-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

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
  await admin.from('intake_items').delete().ilike('batch_label', `${BATCH}%`);
  await admin.from('intake_items').delete().ilike('linkedin_url', `%${BATCH.toLowerCase()}%`);
}

test.describe.configure({ mode: 'serial' });

test.describe('Intake flows (criteria 5.1, 5.2, 5.4)', () => {
  test.beforeEach(async () => {
    await cleanup(await apiAs(PERSONA_EMAILS.admin));
  });

  test.afterEach(async () => {
    await cleanup(await apiAs(PERSONA_EMAILS.admin));
  });

  test('5.1 a batch of pasted LinkedIn URLs creates one intake row each, and the nav badge rises', async ({
    page,
  }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const stamp = Date.now();
    const urls = [1, 2, 3].map((n) => `https://linkedin.com/in/${BATCH.toLowerCase()}-${stamp}-${n}`);

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/intake');

    const readBadge = async () => {
      const badge = page.getByRole('button', { name: /^Intake/ }).locator('.taleo-nav-badge');
      if ((await badge.count()) === 0) return 0;
      return Number(/(\d+)/.exec((await badge.innerText()).trim())?.[1] ?? 0);
    };
    const before = await readBadge();

    await gotoAsSignedIn(page, '/intake/linkedin');
    await expect(page.getByRole('heading', { name: /Paste LinkedIn URLs/ })).toBeVisible();
    await page.getByLabel(/LinkedIn URLs/).fill(urls.join('\n'));
    await page.getByLabel(/Batch label/).fill(`${BATCH}-${stamp}`);
    await page.getByRole('button', { name: 'Save & Continue' }).first().click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('intake_items')
            .select('id')
            .eq('batch_label', `${BATCH}-${stamp}`);
          return data?.length ?? 0;
        },
        { timeout: 25000, message: 'one intake row per pasted URL' },
      )
      .toBe(urls.length);

    const { data: rows } = await admin
      .from('intake_items')
      .select('linkedin_url, channel, target_type, status')
      .eq('batch_label', `${BATCH}-${stamp}`);
    expect(new Set((rows ?? []).map((r) => r.linkedin_url)).size).toBe(urls.length);
    for (const r of rows ?? []) {
      expect(r.channel).toBe('linkedin_url');
      expect(r.target_type).toBe('candidate');
    }

    await gotoAsSignedIn(page, '/intake');
    await expect.poll(readBadge, { timeout: 25000 }).toBeGreaterThan(before);
  });

  test('5.2 a candidate item cannot be imported without a 1-3 star grade and a comment', async ({
    page,
  }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const stamp = Date.now();
    const { data: item, error } = await admin
      .from('intake_items')
      .insert({
        channel: 'linkedin_url',
        target_type: 'candidate',
        full_name: 'QA Grading Gate',
        linkedin_url: `https://linkedin.com/in/${BATCH.toLowerCase()}-grade-${stamp}`,
        batch_label: `${BATCH}-${stamp}`,
        status: 'parsed',
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    const { error: importErr } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
    });
    expect(importErr, 'importing an ungraded candidate item should be refused').not.toBeNull();

    const { error: gradeErr } = await admin
      .from('intake_items')
      .update({ star_grade: 2, grade_comment: 'Worth a screen', status: 'graded' })
      .eq('id', item!.id);
    expect(gradeErr).toBeNull();

    const { error: okErr } = await admin.rpc('import_intake_item', {
      p_intake_id: item!.id,
      p_mode: 'new',
    });
    expect(okErr, 'a graded candidate item should import').toBeNull();

    const { data: after } = await admin
      .from('intake_items')
      .select('status, person_id')
      .eq('id', item!.id)
      .single();
    expect(after?.status).toBe('imported');
    expect(after?.person_id).not.toBeNull();

    if (after?.person_id) {
      const { data: profile } = await admin
        .from('candidate_profiles')
        .select('star_grade, grade_comment')
        .eq('person_id', after.person_id)
        .single();
      expect(profile?.star_grade).toBe(2);
      expect(profile?.grade_comment).toBe('Worth a screen');

      await admin.from('candidate_profiles').delete().eq('person_id', after.person_id);
      await admin.from('people').delete().eq('id', after.person_id);
    }

    await page.close();
  });

  test('5.4 the sheet import asks for a source and offers a preview before committing', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/intake/sheet');

    await expect(page.getByRole('heading', { name: /Import a Sheet/ })).toBeVisible();
    await expect(page.getByLabel(/Sheet URL/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fetch' })).toBeVisible();

    const commit = page.getByRole('button', { name: /Commit|Import all|Confirm/ });
    await expect(commit).toHaveCount(0);
  });
});
