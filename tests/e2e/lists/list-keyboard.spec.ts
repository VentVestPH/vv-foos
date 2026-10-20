import { expect, test, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { gotoAsSignedIn, PERSONA_EMAILS, searchList, signIn } from '../../support/e2e-helpers';

const SUPABASE_URL = process.env.FOOS_SUPABASE_URL ?? 'http://127.0.0.1:56321';
const ANON_KEY = process.env.FOOS_SUPABASE_ANON_KEY ?? '';
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const OWN_TOKEN = `Zkeys${RUN.replace(/[^a-z0-9]/gi, '')}`;

async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: process.env.FOOS_QA_TEST_PASSWORD ?? '',
  });
  if (error) throw error;
  return client;
}

async function seedOwnRows(count: number) {
  const admin = await apiAs(PERSONA_EMAILS.admin);
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const { data, error } = await admin
      .from('people')
      .insert({ first_name: OWN_TOKEN, last_name: `Row${String(i).padStart(2, '0')}`, is_test: true })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(data.id as string);
    const profile = await admin.from('candidate_profiles').insert({ person_id: data.id });
    if (profile.error) throw profile.error;
  }
  return { admin, ids };
}

async function openOwnRows(page: Page, expected: number) {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  await searchList(page, 'Search Candidates', OWN_TOKEN);
  await expect(rows, 'the search narrows to this run\'s own rows').toHaveCount(expected, {
    timeout: 25000,
  });
  return rows;
}

async function openCandidates(page: Page) {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  return rows;
}

function activeKey(page: Page) {
  return page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.closest('tr')?.getAttribute('data-row-key'),
  );
}

test.describe('Q6: the lists are usable from the keyboard', () => {
  test('slash focuses the list search from anywhere on the page', async ({ page }) => {
    await openCandidates(page);
    await page.locator('h1').first().click();
    await page.keyboard.press('/');

    const search = page.getByLabel('Search Candidates');
    await expect(search).toBeFocused();
    await page.keyboard.type('abc');
    await expect(search).toHaveValue('abc');
  });

  test('slash inside a text field types a slash instead of stealing focus', async ({ page }) => {
    await openCandidates(page);
    const search = page.getByLabel('Search Candidates');
    await search.click();
    await page.keyboard.type('a/b');
    await expect(search).toHaveValue('a/b');
  });

  test('j and k walk the rows, Enter opens the record', async ({ page }) => {
    const { admin, ids } = await seedOwnRows(3);
    try {
      const rows = await openOwnRows(page, ids.length);
      const keys = await rows.evaluateAll((ns) =>
        ns.map((n) => n.getAttribute('data-row-key') ?? ''),
      );

      await rows.nth(0).focus();
      expect(await activeKey(page)).toBe(keys[0]);

      await page.keyboard.press('j');
      expect(await activeKey(page)).toBe(keys[1]);

      await page.keyboard.press('k');
      expect(await activeKey(page)).toBe(keys[0]);

      await page.keyboard.press('ArrowDown');
      expect(await activeKey(page)).toBe(keys[1]);

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`/recruit/candidates/${keys[1]}`));
    } finally {
      await admin.from('candidate_profiles').delete().in('person_id', ids);
      const { error } = await admin.from('people').delete().in('id', ids);
      if (error) throw new Error(`could not remove the keyboard fixtures: ${error.message}`);
    }
  });

  test('End and Home jump to the last and first row', async ({ page }) => {
    const { admin, ids } = await seedOwnRows(3);
    try {
      const rows = await openOwnRows(page, ids.length);
      const keys = await rows.evaluateAll((ns) =>
        ns.map((n) => n.getAttribute('data-row-key') ?? ''),
      );

      await rows.nth(0).focus();
      await page.keyboard.press('End');
      expect(await activeKey(page)).toBe(keys[keys.length - 1]);
      await page.keyboard.press('Home');
      expect(await activeKey(page)).toBe(keys[0]);
    } finally {
      await admin.from('candidate_profiles').delete().in('person_id', ids);
      const { error } = await admin.from('people').delete().in('id', ids);
      if (error) throw new Error(`could not remove the keyboard fixtures: ${error.message}`);
    }
  });

  test('space selects the focused row without scrolling the page', async ({ page }) => {
    const rows = await openCandidates(page);
    const key = await rows.nth(0).getAttribute('data-row-key');
    await rows.nth(0).focus();
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await page.keyboard.press(' ');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`),
    ).toBeChecked();
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    await page.keyboard.press('x');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  test('only one row is in the tab order, so the table is one tab stop', async ({ page }) => {
    const rows = await openCandidates(page);
    const tabbable = await page.locator('.table-wrap tbody tr[tabindex="0"]').count();
    expect(tabbable).toBe(1);
    expect(await rows.count()).toBeGreaterThan(1);
  });
});
