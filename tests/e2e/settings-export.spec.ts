import { expect, test } from '@playwright/test';
import {
  NEEDS_IMPORT,
  PERSONA_EMAILS,
  expandSection,
  gotoAsSignedIn,
  hasImportedDataset,
  signIn,
} from './helpers';

test.describe('U6: the Settings data exporter', () => {
  test('an admin sees every module with a live row count from the database', async ({ page }) => {
    test.setTimeout(90000);
    test.skip(!(await hasImportedDataset()), NEEDS_IMPORT);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/settings');
    await page.getByRole('tab', { name: /Data export/ }).click();

    const card = page.getByTestId('data-export');
    await expect(card).toBeVisible({ timeout: 30000 });

    for (const key of ['candidates', 'requisitions', 'companies', 'contacts', 'deals', 'tickets']) {
      await expect(card.getByTestId(`export-${key}`), `${key} has an export button`).toHaveCount(1);
      const count = card.getByTestId(`count-${key}`);
      await expect
        .poll(async () => (await count.innerText()).trim(), {
          timeout: 30000,
          message: `${key} count is still resolving`,
        })
        .not.toBe('…');
      const text = (await count.innerText()).trim();
      expect(text, `${key} shows a number rather than an error`).toMatch(/^[\d,]+$/);
    }

    const candidates = (await card.getByTestId('count-candidates').innerText()).replace(/,/g, '');
    expect(
      Number(candidates),
      'the candidate count comes from the database, so it reflects the migrated data',
    ).toBeGreaterThan(1000);
  });

  test('a non-admin is told it is restricted rather than shown the buttons', async ({ page }) => {
    test.setTimeout(60000);
    await signIn(page, PERSONA_EMAILS.bd);
    await gotoAsSignedIn(page, '/settings');
    await page.getByRole('tab', { name: /Data export/ }).click();

    await expect(page.getByTestId('export-not-admin')).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByTestId('data-export'),
      'the table of export buttons must not render for a non-admin',
    ).toHaveCount(0);
  });

  test('exporting a small module downloads a CSV whose rows match the count shown', async ({
    page,
  }) => {
    test.setTimeout(90000);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/settings');
    await page.getByRole('tab', { name: /Data export/ }).click();

    const card = page.getByTestId('data-export');
    const count = card.getByTestId('count-companies');
    await expect
      .poll(async () => (await count.innerText()).trim(), { timeout: 30000 })
      .not.toBe('…');
    const shown = Number((await count.innerText()).replace(/,/g, ''));
    expect(shown).toBeGreaterThan(0);

    const download = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      card.getByTestId('export-companies').click(),
    ]).then(([d]) => d);

    expect(download.suggestedFilename()).toMatch(/^foos-companies-\d{4}-\d{2}-\d{2}\.csv$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString('utf8');

    let rows = 0;
    let quoted = false;
    for (let i = 0; i < csv.length; i += 1) {
      const ch = csv[i];
      if (quoted) {
        if (ch === '"' && csv[i + 1] === '"') i += 1;
        else if (ch === '"') quoted = false;
        continue;
      }
      if (ch === '"') quoted = true;
      else if (ch === '\n') rows += 1;
    }
    if (csv.length > 0 && !csv.endsWith('\n')) rows += 1;

    expect(
      rows - 1,
      'the CSV must hold exactly the rows the count beside the button promised, ' +
        'counting records rather than newlines so a value containing one is not double counted',
    ).toBe(shown);
  });
});

test.describe('U3.4: application attachments have a surface', () => {
  test('an application attachment is reachable from the candidate page', async ({ page }) => {
    test.setTimeout(90000);
    const { createClient } = await import('@supabase/supabase-js');
    const api = createClient(
      process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321',
      process.env.FOOS_SUPABASE_ANON_KEY ?? '',
    );
    const { error: authErr } = await api.auth.signInWithPassword({
      email: PERSONA_EMAILS.admin,
      password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
    });
    expect(authErr).toBeNull();

    const { data: att, error } = await api
      .from('attachments')
      .select('id, parent_id')
      .eq('parent_type', 'application')
      .limit(1);
    expect(error).toBeNull();
    if (!att || att.length === 0) {
      test.skip(true, 'no application attachment stored yet');
      return;
    }
    const applicationId = att[0].parent_id as string;

    const { data: app } = await api
      .from('applications')
      .select('person_id')
      .eq('id', applicationId)
      .single();
    const personId = app!.person_id as string;

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${personId}?application=${applicationId}`);

    const section = await expandSection(page, 'Application Attachments');
    await expect(
      section,
      'attachments on an application were stored and readable under RLS but rendered nowhere ' +
        'before this section existed',
    ).toBeVisible({ timeout: 30000 });

    await expect
      .poll(async () => section.locator('.panel-item').count(), {
        timeout: 30000,
        message: 'the application attachment list is still loading',
      })
      .toBeGreaterThan(0);

    await expect(
      section.getByText('No files yet.'),
      'the panel must not report the application as having no files when it has one',
    ).toHaveCount(0);

    await expect(
      section.locator('.panel-item .link-btn').first(),
      'the file is openable, so its bytes are in Storage rather than a pending placeholder',
    ).toBeVisible();
  });
});
