import { expect, test } from '@playwright/test';
import { NEEDS_IMPORT, PERSONA_EMAILS, gotoAsSignedIn, hasImportedDataset, signIn } from './helpers';
import { clientAs } from '../env';

test('S1: the default dashboard range shows the data that exists rather than zero', async ({
  page,
}) => {
  test.skip(!(await hasImportedDataset()), NEEDS_IMPORT);
  const admin = await clientAs('admin');
  const { count } = await admin
    .schema('dash')
    .from('vw_requisition_aging')
    .select('*', { count: 'exact', head: true })
    .not('status', 'in', '(filled,closed)');
  expect(count, 'requisitions the panel counts as open').toBeGreaterThan(0);

  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/pipeline');

  await expect(page.getByRole('button', { name: 'Date range' })).toHaveText('All time');

  const aging = page.getByRole('button', { name: /^Requisition Aging/ });
  await expect(aging).toBeVisible({ timeout: 25000 });
  if ((await aging.getAttribute('aria-expanded')) !== 'true') {
    await aging.click();
  }

  const openCount = page.locator('.dash-kpi', { hasText: 'Open requisitions' });
  await expect(openCount).toBeVisible({ timeout: 25000 });
  await expect
    .poll(async () => Number((await openCount.innerText()).replace(/\D/g, '')), {
      timeout: 25000,
    })
    .toBeGreaterThan(0);
  await expect(page.getByText('No open requisitions in range.')).toHaveCount(0);
  await expect(page.locator('.dash-widgets-panel').getByText('No data in range.')).toHaveCount(
    0,
  );
});

test('B2: every panel that hides test records says so, and the two that do not are not labelled', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/pipeline');

  for (const section of [
    'Pipeline by Stage',
    'Requisition Aging',
    'Recruiter/Sourcer Activity',
    'Time in Stage',
    'Source Effectiveness',
  ]) {
    const header = page.getByRole('button', { name: new RegExp(`^${section}`) });
    await expect(header).toBeVisible({ timeout: 25000 });
    if ((await header.getAttribute('aria-expanded')) !== 'true') {
      await header.click();
    }
  }

  const labelled = async (title: string) =>
    page
      .locator('.dash-widget', { has: page.getByRole('heading', { name: title, exact: true }) })
      .locator('.dash-widget-scope');

  for (const title of [
    'ATS pipeline by stage',
    'CRM pipeline by stage',
    'Requisition aging',
    'Logged activity per staff member',
    'Grading volume per staff member',
  ]) {
    await expect(await labelled(title), `${title} should declare it hides test records`).toHaveText(
      'Excludes test records',
    );
  }

  await expect(
    await labelled('Applications advanced (90-day window)'),
    'this panel reads a view that does not filter test records, so it must not claim otherwise',
  ).toHaveCount(0);
});

test('B3: the deal board renders a whole percentage, not a fraction', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.bd);
  await gotoAsSignedIn(page, '/sales/deals');
  const card = page.locator('.sales-kanban-card-value').first();
  await expect(card).toBeVisible({ timeout: 25000 });
  const text = await card.innerText();
  expect(text, 'a probability below 1 percent is the symptom of a stored fraction').not.toMatch(
    /\b0\.\d+%/,
  );
  expect(text).toMatch(/\b\d{1,3}%/);
});
