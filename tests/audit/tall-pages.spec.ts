import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, signIn } from '../support/e2e-helpers';
import { ROUTES, resolveIds, resolvePath } from '../support/routes';
import { DESKTOP, dir, findScroller, settle, shootTallViewport } from './sweep-lib';
import { join } from 'node:path';

const ROLE = (process.env.SWEEP_ROLE ?? 'admin') as keyof typeof PERSONA_EMAILS;
const ONLY = (process.env.SWEEP_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean);

test(`one tall image per page, as ${ROLE}`, async ({ page }) => {
  test.setTimeout(0);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS[ROLE]);

  const outDir = dir('tall', ROLE);
  let shot = 0;
  for (const route of ROUTES) {
    if (ONLY.length > 0 && !ONLY.includes(route.id)) continue;
    const path = resolvePath(route, ids);
    if (path === null) continue;
    try {
      await page.goto(path);
      await settle(page, 10000);

      const landed = new URL(page.url()).pathname + new URL(page.url()).search;
      if (landed !== path) {
        console.log(`TALL ${ROLE} ${route.id} NOT CAPTURED, asked for ${path} and landed on ${landed}`);
        continue;
      }

      const headers = page.locator('.record-section-header');
      const total = await headers.count();
      let opened = 0;
      for (let i = 0; i < total; i += 1) {
        const h = headers.nth(i);
        if ((await h.getAttribute('aria-expanded')) === 'false') {
          await h.click({ timeout: 5000 }).catch(() => undefined);
          opened += 1;
        }
      }
      if (opened > 0) await settle(page, 8000);
      const stillShut = await headers.evaluateAll(
        (els) => els.filter((e) => e.getAttribute('aria-expanded') === 'false').length,
      );
      const tabs = await page.getByRole('tab').count();

      const file = join(outDir, `${route.id}.png`);
      const shotInfo = await shootTallViewport(page, file);
      shot += 1;
      console.log(
        `TALL ${ROLE} ${route.id} content=${shotInfo.content} window=${shotInfo.viewport} accordions=${total} opened=${opened} stillShut=${stillShut} tabs=${tabs}`,
      );
    } catch (err) {
      console.log(`TALL ${ROLE} ${route.id} FAILED ${String(err).split('\n')[0]?.slice(0, 140)}`);
    }
  }
  console.log(`TALL TOTAL ${ROLE} images=${shot}`);
  expect(shot).toBeGreaterThan(0);
});
