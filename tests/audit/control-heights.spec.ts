import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

const SCALE = [24, 32, 40, 48];

test('buttons and single-line fields sit on the published height scale', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  const heights = new Map<string, number>();
  const offenders = new Map<string, string>();
  let measured = 0;

  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(450);
    const found = await page.evaluate(() => {
      const out: { h: number; name: string; cls: string }[] = [];
      const sel = 'button.btn, .field input:not([type="checkbox"]):not([type="radio"]), .field select, .input';
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const e = el as HTMLElement;
        const r = e.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        out.push({
          h: Math.round(r.height * 100) / 100,
          name: (e.getAttribute('aria-label') ?? e.innerText ?? e.tagName).trim().slice(0, 30),
          cls: e.className.toString().slice(0, 60),
        });
      }
      return out;
    });
    for (const f of found) {
      measured += 1;
      heights.set(String(f.h), (heights.get(String(f.h)) ?? 0) + 1);
      if (!SCALE.includes(Math.round(f.h))) {
        offenders.set(`${f.h}px ${f.cls}`, `${route.id}: "${f.name}"`);
      }
    }
  }

  const sorted = [...heights.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log(`PROBE controlsMeasured=${measured} distinctHeights=${sorted.length}`);
  for (const [h, n] of sorted) console.log(`  HEIGHT ${h}px x${n}`);
  for (const [k, v] of [...offenders].slice(0, 12)) console.log(`  OFFENDER ${k}  first seen ${v}`);

  expect(measured).toBeGreaterThan(0);
  expect([...offenders.keys()]).toEqual([]);
});
