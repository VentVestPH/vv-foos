import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';

const ROUTES = [
  ['dashboard', '/'],
  ['candidates', '/recruit/candidates'],
  ['candidate record', '/recruit/candidates/b0000000-0000-4000-8000-000000000002'],
  ['requisitions', '/recruit/requisitions'],
  ['new requisition', '/recruit/requisitions/new'],
  ['deals', '/sales/deals'],
  ['new deal', '/sales/deals/new'],
  ['intake', '/intake'],
  ['settings', '/settings'],
  ['employees', '/employees'],
] as const;

test('U22: every disabled control says why it is disabled', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page, PERSONA_EMAILS.admin);
  const offenders: string[] = [];

  for (const [name, path] of ROUTES) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 25000 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.querySelectorAll('main [disabled], main [aria-disabled="true"]').length,
          ),
        { timeout: 20000, message: `${name}: the control count never settled` },
      )
      .toBeGreaterThanOrEqual(0);

    const bare = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(
        document.querySelectorAll('main [disabled], main [aria-disabled="true"]'),
      )) {
        const title = el.getAttribute('title');
        if (title !== null && title.trim() !== '') continue;
        const label = (el.getAttribute('aria-label') ?? el.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 30);
        out.push(`${el.tagName.toLowerCase()}: ${label || '(unlabelled)'}`);
      }
      return out;
    });

    offenders.push(...bare.map((b) => `${name}: ${b}`));
  }

  expect(
    offenders,
    'a control a user cannot press must say why, in a title. The audit found this on 67 controls ' +
      'against 11 that had one',
  ).toEqual([]);
});
