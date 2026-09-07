import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

test('every textarea resizes vertically only', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  const seen = new Map<string, number>();
  let total = 0;
  let offenders = 0;
  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(500);
    const vals = await page
      .locator('textarea')
      .evaluateAll((ns) => ns.map((n) => getComputedStyle(n).resize));
    for (const v of vals) {
      total += 1;
      seen.set(v, (seen.get(v) ?? 0) + 1);
      if (v !== 'vertical') offenders += 1;
    }
  }
  console.log(`PROBE textareas=${total} byResize=${JSON.stringify(Object.fromEntries(seen))} offenders=${offenders}`);
  expect(offenders).toBe(0);
  expect(total).toBeGreaterThan(0);
});
