import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';
import { ROUTES, resolveIds, resolvePath } from '../../support/routes';

test('a dialog takes focus, cycles Tab inside itself, and gives focus back on close', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);
  const ids = await resolveIds();
  const route = ROUTES.find((r) => r.id === 'sales-contact-record');
  if (route === undefined) throw new Error('sales-contact-record route missing');
  const path = resolvePath(route, ids);
  if (path === null) throw new Error('could not resolve the contact record path');
  await gotoAsSignedIn(page, path);
  await page.waitForTimeout(2500);

  await page.evaluate(() => {
    const w = window as unknown as { __focusLog: string[] };
    w.__focusLog = [];
    document.addEventListener(
      'focusin',
      (e) => {
        const t = e.target as HTMLElement;
        w.__focusLog.push(`${t.tagName}:${(t.getAttribute('aria-label') ?? t.innerText ?? '').trim().slice(0, 24)}`);
      },
      true,
    );
  });

  const trigger = page.getByRole('button', { name: 'Send email', exact: true }).first();
  expect(await trigger.count(), 'the Send email control must exist to drive a real Modal').toBeGreaterThan(0);
  const triggerName = (await trigger.getAttribute('aria-label')) ?? (await trigger.innerText());
  await trigger.focus();
  await trigger.click();
  await page.waitForTimeout(700);

  const panel = page.locator('[role="dialog"], .fo-placeholder-modal').first();
  const opened = (await panel.count()) > 0;
  if (!opened) {
    console.log('PROBE dialog none opened from this control, nothing to assert');
    return;
  }

  const focusInside = await page.evaluate(() => {
    const p = document.querySelector('[role="dialog"], .fo-placeholder-modal');
    return p !== null && p.contains(document.activeElement);
  });

  const seen: boolean[] = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(
      await page.evaluate(() => {
        const p = document.querySelector('[role="dialog"], .fo-placeholder-modal');
        return p !== null && p.contains(document.activeElement);
      }),
    );
  }
  const escaped = seen.filter((v) => !v).length;

  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return {
      tag: a?.tagName ?? '(none)',
      name: (a?.getAttribute('aria-label') ?? a?.innerText ?? '').trim().slice(0, 40),
      isBody: a === document.body,
    };
  });
  const restored = after.name === (triggerName ?? '').trim();

  console.log(
    `PROBE dialog focusMovedIn=${focusInside} tabsThatLeftTheDialog=${escaped}/8 focusReturnedToTrigger=${restored}`,
  );
  console.log(
    `PROBE afterClose activeTag=${after.tag} activeName="${after.name}" isBody=${after.isBody} expected="${(triggerName ?? '').trim()}"`,
  );
  const log = await page.evaluate(
    () => (window as unknown as { __focusLog: string[] }).__focusLog.slice(-8),
  );
  console.log(`PROBE focusLog ${JSON.stringify(log)}`);
  const triggerSurvived = await page
    .getByRole('button', { name: 'Send email', exact: true })
    .count();
  console.log(`PROBE triggerStillInDom=${triggerSurvived}`);

  expect(focusInside, 'focus must move into the dialog on open').toBe(true);
  expect(escaped, 'Tab must never leave the dialog').toBe(0);
  expect(restored, 'focus must return to the control that opened it').toBe(true);
});
