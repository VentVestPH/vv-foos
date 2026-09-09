import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test('K17: the intake queue honours a channel in the URL, so a bar can link to it', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/intake?channel=linkedin_url');
  const toggle = page.getByRole('button', { name: 'Advanced Search' });
  await expect(toggle).toBeVisible({ timeout: 25000 });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  const picker = page.getByRole('combobox', { name: /channel/i }).first();
  await expect(picker, 'the intake queue must expose its channel filter').toBeVisible({
    timeout: 25000,
  });
  await expect(picker, 'the channel from the URL must be preselected').toContainText(/linkedin/i);
});

test('K17: no dashboard panel explains the codebase to the user', async ({ page }) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  const banned = [
    'useSearchParams',
    "aren't clickable",
    'local component state',
    'published URL',
    'materialized view',
    'definer-refreshed',
    'audit_log is admin-read',
    'mv_stage_durations',
  ];
  const offenders: string[] = [];

  for (const path of ['/pipeline', '/reports']) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('.dash-widgets-panel')).toBeVisible({ timeout: 25000 });
    for (const section of [
      'Pipeline by Stage',
      'Requisition Aging',
      'Recruiter/Sourcer Activity',
      'Time in Stage',
      'Source Effectiveness',
    ]) {
      const header = page.getByRole('button', { name: new RegExp(`^${section}`) });
      if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click();
    }
    const text = await page.locator('.dash-widgets-panel').innerText();
    for (const phrase of banned) {
      if (text.includes(phrase)) offenders.push(`${path}: "${phrase}"`);
    }
  }

  expect(offenders, 'panel copy is for users, not for whoever maintains the query').toEqual([]);
});
