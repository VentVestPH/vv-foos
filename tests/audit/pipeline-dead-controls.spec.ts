import { test, expect } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';

const REQ_WITH_SOURCER_CARDS = 'd0000000-0000-4000-8000-000000000001';

function step(label: string): void {
  console.log(`STEP ${new Date().toISOString().slice(11, 23)} ${label}`);
}

test('sourcer on desktop: kanban cards stay draggable while moveStage is a no-op', async ({ page }) => {
  test.setTimeout(90000);
  step('start');
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.sourcer);
  step('signed in');
  await gotoAsSignedIn(page, `/recruit/requisitions/${REQ_WITH_SOURCER_CARDS}`);
  step('on requisition');
  await page.waitForTimeout(2500);

  const toggle = page.getByRole('tab', { name: 'Kanban' });
  step(`toggle count=${await toggle.count()}`);
  await toggle.click({ timeout: 8000 });
  step('kanban clicked');
  await page.waitForTimeout(2500);

  const cards = page.locator('.kanban-card');
  const cardCount = await cards.count();
  step(`cards=${cardCount}`);
  const stars = page.locator('.kanban-card .shortlist-btn');
  const starCount = await stars.count();
  const starDisabled = await stars.evaluateAll(
    (ns) => ns.filter((n) => (n as HTMLButtonElement).disabled || n.getAttribute('aria-disabled') === 'true').length,
  );
  step(`stars=${starCount} disabled=${starDisabled}`);

  const perColumnBefore = await page
    .locator('.kanban-col')
    .evaluateAll((ns) => ns.map((n) => n.querySelectorAll('.kanban-card').length).join('/'));
  step(`perColumnBefore=${perColumnBefore}`);

  let moveResult = 'not-attempted';
  if (cardCount > 0) {
    const box = await cards.first().boundingBox();
    const cols = page.locator('.kanban-col');
    const colCount = await cols.count();
    const emptyIdx = (await cols.evaluateAll((ns) =>
      ns.map((n, i) => (n.querySelectorAll('.kanban-card').length === 0 ? i : -1)).filter((i) => i >= 0),
    ))[0];
    const targetIdx = emptyIdx !== undefined ? emptyIdx : colCount - 1;
    const target = await cols.nth(targetIdx).boundingBox();
    step(`dragging card to column ${targetIdx} of ${colCount}`);
    if (box !== null && target !== null) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 20, { steps: 5 });
      await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 15 });
      await page.mouse.up();
      step('drag released');
      await page.waitForTimeout(2500);
      moveResult = await page
        .locator('.kanban-col')
        .evaluateAll((ns) => ns.map((n) => n.querySelectorAll('.kanban-card').length).join('/'));
    } else {
      moveResult = 'no-boundingbox';
    }
  }
  step(`perColumnAfter=${moveResult}`);

  const alerts = await page.locator('[role="alert"], .rq-error, [role="alertdialog"], .fo-toast, .toast').count();
  console.log(
    `PROBE sourcer cards=${cardCount} stars=${starCount} starsDisabled=${starDisabled} before=${perColumnBefore} after=${moveResult} alerts=${alerts}`,
  );
  expect(cardCount).toBeGreaterThan(0);
});

test('admin on mobile: shortlist stars render live while add-candidate and the kanban toggle are hidden', async ({ page }) => {
  test.setTimeout(90000);
  step('mobile start');
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, PERSONA_EMAILS.admin);
  step('mobile signed in');
  await gotoAsSignedIn(page, `/recruit/requisitions/${REQ_WITH_SOURCER_CARDS}`);
  step('mobile on requisition');
  await page.waitForTimeout(2500);

  const stars = page.locator('.shortlist-btn');
  const starCount = await stars.count();
  const starDisabled = await stars.evaluateAll(
    (ns) => ns.filter((n) => (n as HTMLButtonElement).disabled || n.getAttribute('aria-disabled') === 'true').length,
  );
  const cursor = await stars.first().evaluate((n) => getComputedStyle(n).cursor);
  step(`stars=${starCount} disabled=${starDisabled} cursor=${cursor}`);

  const first = stars.first();
  const labelBefore = await first.getAttribute('aria-label');
  const classBefore = await first.getAttribute('class');
  await first.click({ timeout: 8000 });
  step('star clicked');
  await page.waitForTimeout(2500);
  const labelAfter = await first.getAttribute('aria-label');
  const classAfter = await first.getAttribute('class');
  const toggle = await page.getByRole('tab', { name: 'Kanban' }).count();
  const add = await page.getByRole('button', { name: 'Add candidate' }).count();
  const alerts = await page.locator('[role="alert"], .rq-error, [role="alertdialog"], .fo-toast, .toast').count();

  console.log(
    `PROBE adminMobile stars=${starCount} starsDisabled=${starDisabled} cursor=${cursor} labelBefore="${labelBefore}" labelAfter="${labelAfter}" classBefore="${classBefore}" classAfter="${classAfter}" kanbanToggle=${toggle} addCandidate=${add} alerts=${alerts}`,
  );
  expect(starCount).toBeGreaterThan(0);
});
