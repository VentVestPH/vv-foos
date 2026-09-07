import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

test('inline row inputs keep their keystrokes instead of firing row shortcuts', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  const route = ROUTES.find((r) => r.id === 'recruit-requisition-record');
  if (route === undefined) throw new Error('requisition record route missing');
  const path = resolvePath(route, ids);
  if (path === null) throw new Error('could not resolve the requisition record path');
  await gotoAsSignedIn(page, path);
  await page.waitForTimeout(3000);

  const inline = page.locator('tbody input[aria-label^="Next step"]').first();
  const count = await page.locator('tbody input[aria-label^="Next step"]').count();
  expect(count).toBeGreaterThan(0);

  const urlBefore = page.url();
  const rowsBefore = await page.locator('tbody tr:not(:has(td[colspan]))').count();
  await inline.click({ timeout: 8000 });
  await inline.fill('');
  await inline.type('jkx step', { delay: 25 });
  const typed = await inline.inputValue();
  const selectedAfterTyping = await page.locator('tbody input[type="checkbox"]:checked').count();
  const urlAfterTyping = page.url();

  console.log(
    `PROBE inlineInputs=${count} rows=${rowsBefore} typed="${typed}" navigatedAway=${urlAfterTyping !== urlBefore} rowsSelectedByTyping=${selectedAfterTyping}`,
  );

  expect(typed).toBe('jkx step');
  expect(urlAfterTyping).toBe(urlBefore);
  expect(selectedAfterTyping).toBe(0);
});
