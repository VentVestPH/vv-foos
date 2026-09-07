import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

test('every control that responds shows a pointer cursor and does not claim to be disabled', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  let responding = 0;
  let notPointer = 0;
  let falseDisabled = 0;
  const offenders: string[] = [];

  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(450);
    const found = await page.evaluate(() => {
      const out: { name: string; cursor: string; ariaDisabled: boolean; nativelyDisabled: boolean }[] = [];
      for (const el of Array.from(document.querySelectorAll('.is-placeholder'))) {
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        out.push({
          name: (e.getAttribute('aria-label') ?? e.innerText ?? '').trim().slice(0, 40),
          cursor: getComputedStyle(e).cursor,
          ariaDisabled: e.getAttribute('aria-disabled') === 'true',
          nativelyDisabled: (e as HTMLButtonElement).disabled === true,
        });
      }
      return out;
    });
    for (const f of found) {
      responding += 1;
      if (f.cursor !== 'pointer' && !f.nativelyDisabled) {
        notPointer += 1;
        offenders.push(`${route.id}: "${f.name}" cursor=${f.cursor}`);
      }
      if (f.ariaDisabled) {
        falseDisabled += 1;
        offenders.push(`${route.id}: "${f.name}" still claims aria-disabled`);
      }
    }
  }
  console.log(
    `PROBE respondingPlaceholders=${responding} notPointer=${notPointer} falselyDisabled=${falseDisabled}`,
  );
  for (const o of offenders.slice(0, 10)) console.log(`  OFFENDER ${o}`);
  expect(notPointer).toBe(0);
  expect(falseDisabled).toBe(0);
  expect(responding).toBeGreaterThan(0);
});
