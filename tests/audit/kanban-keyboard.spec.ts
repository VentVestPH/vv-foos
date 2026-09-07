import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

test('kanban cards: a control inside a card owns its own Enter', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  const route = ROUTES.find((r) => r.id === 'recruit-requisition-record');
  if (route === undefined) throw new Error('requisition record route missing');
  const path = resolvePath(route, ids);
  if (path === null) throw new Error('could not resolve the requisition record path');
  await gotoAsSignedIn(page, path);
  await page.waitForTimeout(2500);

  await page.getByRole('tab', { name: 'Kanban' }).click({ timeout: 8000 });
  await page.waitForTimeout(2500);

  const nameBtn = page.locator('.kanban-card .kanban-card-name').first();
  const cards = await page.locator('.kanban-card').count();
  const urlBefore = page.url();
  await nameBtn.focus();
  const focusedClass = await page.evaluate(() => document.activeElement?.className ?? '(none)');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  const grabbed = await page.locator('.kanban-card.grabbed').count();
  const opened = page.url() !== urlBefore;
  console.log(
    `PROBE recruitCard cards=${cards} focused="${focusedClass}" openedByEnter=${opened} cardGrabbed=${grabbed}`,
  );

  await gotoAsSignedIn(page, '/sales/deals');
  await page.waitForTimeout(2500);
  const openBtns = await page.locator('.sales-kanban-card-open').count();
  const wholeCardClickable = await page.evaluate(
    () => document.querySelectorAll('.sales-kanban-card[onclick]').length,
  );
  let dealOpened = 'n/a';
  if (openBtns > 0) {
    const u = page.url();
    await page.locator('.sales-kanban-card-open').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    dealOpened = String(page.url() !== u);
  }
  console.log(
    `PROBE dealCard openButtons=${openBtns} wholeCardOnclick=${wholeCardClickable} openedByEnter=${dealOpened}`,
  );

  expect(opened).toBe(true);
  expect(grabbed).toBe(0);
});
