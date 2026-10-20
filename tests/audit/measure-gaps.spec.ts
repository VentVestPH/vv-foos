import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../support/e2e-helpers';
import { ROUTES, resolveIds, resolvePath } from '../support/routes';
import { DESKTOP, dir, pageHeight, sectionGapDetail, settle } from './sweep-lib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROLE = (process.env.SWEEP_ROLE ?? 'admin') as keyof typeof PERSONA_EMAILS;

test(`measure vertical rhythm on every route, as ${ROLE}`, async ({ page }) => {
  test.setTimeout(0);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  await page.setViewportSize(DESKTOP);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS[ROLE]);

  const out: Record<string, unknown>[] = [];
  for (const route of ROUTES) {
    const path = resolvePath(route, ids);
    if (path === null) continue;
    try {
      await gotoAsSignedIn(page, path);
      await settle(page, 10000);
      const gaps = await sectionGapDetail(page);
      const height = await pageHeight(page);
      out.push({ role: ROLE, route: route.id, path, pageHeight: height, gaps });
      const worst = [...gaps].sort((a, b) => b.gap - a.gap)[0];
      console.log(
        `GAPS ${ROLE} ${route.id} height=${height} pairs=${gaps.length} worst=${worst ? `${worst.gap}px between ${worst.above} and ${worst.below}` : 'none'}`,
      );
    } catch (err) {
      const message = String(err).split('\n')[0]?.slice(0, 160) ?? 'unknown';
      out.push({ role: ROLE, route: route.id, path, error: message });
      console.log(`GAPS ${ROLE} ${route.id} FAILED ${message}`);
    }
  }

  writeFileSync(join(dir('measurements', ROLE), '_gaps.json'), JSON.stringify(out, null, 2));
  console.log(`GAPS TOTAL ${ROLE} routes=${out.length}`);
  expect(out.length).toBeGreaterThan(0);
});
