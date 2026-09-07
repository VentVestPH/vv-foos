import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, optionNames, signIn } from './helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:55321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const VIEW_NAME = `QA Saved View ${RUN} recruiter`;
const SOURCER_VIEW_NAME = `QA Saved View ${RUN} sourcer`;
const PENDING_NAME = '…';


function csvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(cell);
      records.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    records.push(row);
  }
  return records;
}

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

test.describe('List persistence and export (criteria 2.9 and 2.11)', () => {
  test.afterEach(async () => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await admin.from('ats_saved_views').delete().ilike('name', `QA Saved View ${RUN}%`);
  });

  test('2.9 a saved view survives a completely new browser session', async ({ browser }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    await admin.from('ats_saved_views').delete().ilike('name', `QA Saved View ${RUN}%`);

    const first = await browser.newContext();
    const page = await first.newPage();
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');

    await page.getByRole('button', { name: 'Save view', exact: true }).click();
    const dialog = page.locator('[role="dialog"], .modal, .fo-modal').first();
    await expect(dialog).toBeVisible({ timeout: 20000 });
    await dialog.getByLabel(/^View name/).fill(VIEW_NAME);
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20000 });

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('ats_saved_views')
            .select('id, entity, staff_id')
            .eq('name', VIEW_NAME);
          return data?.length ?? 0;
        },
        { timeout: 20000, message: 'the saved view should be persisted server-side' },
      )
      .toBe(1);

    await first.close();

    const second = await browser.newContext();
    const page2 = await second.newPage();
    await signIn(page2, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page2, '/recruit/candidates');

    const savedViewSelect = page2.getByRole('combobox', { name: 'Saved views' });
    await expect
      .poll(async () => (await optionNames(page2, savedViewSelect)).join('|'), { timeout: 25000 })
      .toContain(VIEW_NAME);
    expect((await optionNames(page2, savedViewSelect)).join('|')).toContain(VIEW_NAME);
    await second.close();
  });

  test('2.9 another staff member does not see that saved view', async ({ browser }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const { error } = await admin.from('ats_saved_views').insert([
      {
        name: VIEW_NAME,
        entity: 'candidate',
        staff_id: 'a0000000-0000-4000-8000-000000000002',
        filters: {},
      },
      {
        name: SOURCER_VIEW_NAME,
        entity: 'candidate',
        staff_id: 'a0000000-0000-4000-8000-000000000003',
        filters: {},
      },
    ]);
    expect(error, error?.message).toBeNull();

    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await openFilterRail(page);

    const select = page.getByRole('combobox', { name: 'Saved views' });
    let offered = '';
    await expect
      .poll(
        async () => {
          offered = (await optionNames(page, select)).join('|');
          return offered;
        },
        { timeout: 25000 },
      )
      .toContain(SOURCER_VIEW_NAME);
    expect(offered).not.toContain(VIEW_NAME);
    await context.close();
  });

  test('2.11 the CSV export matches the filtered set on screen', async ({ page }) => {
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const token = `Zexport${RUN.replace(/[^a-z0-9]/gi, '')}`;
    const created: string[] = [];

    try {
      for (const suffix of ['Alpha', 'Bravo', 'Charlie']) {
        const { data, error } = await admin
          .from('people')
          .insert({ first_name: token, last_name: suffix, is_test: true })
          .select('id')
          .single();
        if (error) throw error;
        created.push(data.id);
        const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
        if (profile.error) throw profile.error;
      }

      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, '/recruit/candidates');

      const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
      await expect(rows.first()).toBeVisible({ timeout: 25000 });

      await page.getByRole('searchbox', { name: 'Search Candidates' }).fill(token);

      await expect(rows, 'the search narrows to exactly this run\'s three candidates').toHaveCount(
        created.length,
        { timeout: 25000 },
      );
      await expect
        .poll(
          async () =>
            (await rows.locator('.link-btn').allInnerTexts()).filter((t) => t.trim() === PENDING_NAME)
              .length,
          { timeout: 25000, message: 'candidate names are still resolving' },
        )
        .toBe(0);

      const onScreen: string[] = [];
      for (const row of await rows.all()) {
        onScreen.push((await row.locator('.link-btn').first().innerText()).trim());
      }
      expect(onScreen.filter((n) => n === ''), 'every visible row has a resolved name').toEqual([]);
      expect(onScreen).toHaveLength(created.length);

      const download = await Promise.all([
        page.waitForEvent('download', { timeout: 25000 }),
        page.getByRole('button', { name: 'Export CSV', exact: true }).click(),
      ]).then(([d]) => d);

      expect(download.suggestedFilename()).toMatch(/\.csv$/);
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const csv = Buffer.concat(chunks).toString('utf8');

      const records = csvRecords(csv);
      await test.info().attach('export.csv', { body: csv, contentType: 'text/csv' });
      await test.info().attach('on-screen.json', {
        body: JSON.stringify(onScreen, null, 2),
        contentType: 'application/json',
      });

      expect(
        records.length,
        `a header plus one record per visible row; got ${records.length} records for ${onScreen.length} rows`,
      ).toBe(onScreen.length + 1);

      const exportedNames = records.slice(1).map((r) => r[0]?.trim() ?? '');
      expect(new Set(exportedNames), 'the export names are exactly the names on screen').toEqual(
        new Set(onScreen),
      );
    } finally {
      if (created.length) {
        await admin.from('candidate_profiles').delete().in('person_id', created);
        const { error } = await admin.from('people').delete().in('id', created);
        if (error) throw new Error(`could not remove the export fixtures: ${error.message}`);
        const { data } = await admin.from('people').select('id').in('id', created);
        if (data?.length) throw new Error(`${data.length} export fixture(s) survived teardown`);
      }
    }
  });
});

test.describe('a slow first response must not overwrite a search', () => {
  test('the list keeps the filtered rows when the unfiltered query lands late', async ({
    page,
  }) => {
    test.setTimeout(90000);
    const admin = await apiAs(PERSONA_EMAILS.admin);
    const token = `Zstale${RUN.replace(/[^a-z0-9]/gi, '')}`;
    const created: string[] = [];

    try {
      for (const suffix of ['One', 'Two']) {
        const { data, error } = await admin
          .from('people')
          .insert({ first_name: token, last_name: suffix, is_test: true })
          .select('id')
          .single();
        if (error) throw error;
        created.push(data.id);
        const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
        if (profile.error) throw profile.error;
      }

      let seen = 0;
      await page.route(/rest\/v1\/candidate_list/, async (route) => {
        seen += 1;
        if (seen === 1) await new Promise((resolve) => setTimeout(resolve, 2500));
        await route.continue();
      });

      await signIn(page, PERSONA_EMAILS.recruiter);
      await gotoAsSignedIn(page, '/recruit/candidates');
      await page.getByRole('searchbox', { name: 'Search Candidates' }).fill(token);

      const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
      await expect(
        rows,
        'the search result must survive the slower unfiltered response landing after it. ' +
          'Without a latest-response guard the stale payload overwrites the filtered rows ' +
          'and nothing triggers another load, so the screen shows a full unfiltered page ' +
          'with the search term still in the box',
      ).toHaveCount(created.length, { timeout: 30000 });

      await page.waitForTimeout(3000);
      await expect(rows, 'and it must still hold after the delayed response arrives').toHaveCount(
        created.length,
      );
    } finally {
      await page.unrouteAll().catch(() => undefined);
      for (const id of created) {
        const prof = await admin.from('candidate_profiles').delete().eq('person_id', id);
        if (prof.error) throw prof.error;
        const person = await admin.from('people').delete().eq('id', id);
        if (person.error) throw person.error;
      }
    }
  });
});
