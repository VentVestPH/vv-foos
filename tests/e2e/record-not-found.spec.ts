import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const MISSING = '00000000-0000-4000-8000-0000000000ff';

async function candidateInvisibleToSourcer(): Promise<string | null> {
  const admin = await clientAs('admin');
  const sourcer = await clientAs('sourcer');
  const { data: mine } = await sourcer.from('candidate_profiles').select('person_id');
  const excluded = new Set((mine ?? []).map((r) => r.person_id as string));
  const { data: all } = await admin
    .from('candidate_profiles')
    .select('person_id')
    .order('person_id')
    .limit(50);
  const hit = (all ?? []).find((r) => !excluded.has(r.person_id as string));
  return (hit?.person_id as string) ?? null;
}

test('QA: a candidate record that does not exist says so instead of loading for ever', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/candidates/${MISSING}`);
  await expect(page.getByRole('heading', { name: 'Candidate not found' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('QA: a requisition record that does not exist says so instead of loading for ever', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/requisitions/${MISSING}`);
  await expect(page.getByRole('heading', { name: 'Requisition not found' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('U116: a candidate a sourcer cannot see says so instead of loading for ever', async ({
  page,
}) => {
  const personId = await candidateInvisibleToSourcer();
  expect(personId, 'no candidate outside the sourcer own set').not.toBeNull();
  await signIn(page, PERSONA_EMAILS.sourcer);
  await gotoAsSignedIn(page, `/recruit/candidates/${personId}`);
  await expect(page.getByRole('heading', { name: 'Candidate not found' })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('U44: the deal board prints no literal unicode escapes', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.bd);
  await gotoAsSignedIn(page, '/sales/deals');
  await expect(page.locator('.sales-kanban-card-name').first()).toBeVisible({ timeout: 25000 });
  const offenders = await page.locator('main').evaluate((root) => {
    const found: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue ?? '';
      if (/\\u[0-9a-fA-F]{4}/.test(text)) found.push(text.trim().slice(0, 80));
      node = walker.nextNode();
    }
    return found;
  });
  expect(offenders, 'text nodes printing a unicode escape as literal characters').toEqual([]);
});

test('U69: the Users page lists the staff that exist instead of claiming there are none', async ({
  page,
}) => {
  const admin = await clientAs('admin');
  const { data } = await admin.from('staff').select('id');
  const expected = (data ?? []).length;
  expect(expected).toBeGreaterThan(0);

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/users');
  await expect(page.getByRole('heading', { name: /^Users/ })).toBeVisible({ timeout: 20000 });
  await expect
    .poll(() => page.locator('main table tbody tr').count(), { timeout: 20000 })
    .toBe(expected);
  await expect(
    page.getByText('There are currently no users in your Front Office OS system.'),
  ).toHaveCount(0);
});
