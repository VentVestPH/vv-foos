import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../e2e/helpers';
import { ROUTES, resolveIds, resolvePath } from './routes';

const SCALE = [16, 20, 24, 40];

test('every rendered icon box sits on the token scale', async ({ page }) => {
  test.setTimeout(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  const sizes = new Map<string, number>();
  const offenders = new Map<string, string>();
  let measured = 0;

  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    await gotoAsSignedIn(page, path);
    await page.waitForTimeout(450);
    const found = await page.evaluate(() => {
      const out: { w: number; h: number; cls: string }[] = [];
      for (const el of Array.from(document.querySelectorAll('svg.lucide'))) {
        const r = (el as SVGElement).getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        out.push({
          w: Math.round(r.width),
          h: Math.round(r.height),
          cls: (el as SVGElement).getAttribute('class')?.slice(0, 60) ?? '',
        });
      }
      return out;
    });
    for (const f of found) {
      measured += 1;
      sizes.set(String(f.w), (sizes.get(String(f.w)) ?? 0) + 1);
      if (!SCALE.includes(f.w) || f.w !== f.h) {
        offenders.set(`${f.w}x${f.h} ${f.cls}`, `${route.id}`);
      }
    }
  }

  const sorted = [...sizes.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log(`PROBE iconsMeasured=${measured} distinctSizes=${sorted.length} floor=${sorted[0]?.[0]}`);
  for (const [w, n] of sorted) console.log(`  ICON ${w}px x${n}`);
  for (const [k, v] of [...offenders].slice(0, 12)) console.log(`  OFFENDER ${k}  first seen ${v}`);

  expect(measured).toBeGreaterThan(0);
  expect([...offenders.keys()]).toEqual([]);
});

test('the sidebar chevron rotates through a transitioned class', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/');

  const collapse = page.locator('.fo-sidebar-collapse-btn');
  const chevron = page.locator('.fo-sidebar-collapse-chevron');
  await expect(collapse).toHaveCount(1);
  await expect(chevron).toHaveCount(1);

  const before = await chevron.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { transform: cs.transform, transition: cs.transitionProperty, inline: el.getAttribute('style') };
  });
  await collapse.click();
  await page.waitForTimeout(300);
  const after = await chevron.evaluate((el) => getComputedStyle(el).transform);

  console.log(
    `PROBE chevron transitionProperty=${before.transition} inlineStyle=${before.inline} before=${before.transform} after=${after}`,
  );

  expect(before.transition).toContain('transform');
  expect(before.inline).toBeNull();
  expect(after).not.toBe(before.transform);
});

test('the dashboard bars grow on the compositor, not by width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/?tab=pipeline');
  await page.waitForTimeout(700);

  const fill = page.locator('.dash-barlist-fill').first();
  await expect(fill).toBeVisible();
  const style = await fill.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      origin: cs.transformOrigin,
      animation: cs.animationName,
      duration: cs.animationDuration,
      transition: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
      width: el.getAttribute('style'),
    };
  });

  console.log(
    `PROBE bar origin=${style.origin} animation=${style.animation} duration=${style.duration} transitionProperty=${style.transition} transitionDuration=${style.transitionDuration} inline=${style.width}`,
  );

  expect(style.animation).toBe('dash-bar-grow');
  expect(style.origin.startsWith('0px')).toBe(true);
  expect(style.transitionDuration).toBe('0s');
  expect(style.width).toContain('width:');
});
