import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from '../../support/e2e-helpers';
import { ROUTES, resolveIds, resolvePath } from '../../support/routes';

test('row-level controls carry their row identity in the accessible name', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await resolveIds();
  await signIn(page, PERSONA_EMAILS.admin);

  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(900);

  const shared = await page.evaluate(() => {
    const names = new Map<string, number>();
    for (const el of Array.from(
      document.querySelectorAll('.table-wrap tbody button, .table-wrap tbody input, .table-wrap tbody [role="radiogroup"], .table-wrap tbody [role="img"]'),
    )) {
      const e = el as HTMLElement;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const n = (e.getAttribute('aria-label') ?? e.innerText ?? '').trim();
      if (n === '') continue;
      names.set(n, (names.get(n) ?? 0) + 1);
    }
    const worst = [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const duplicated = [...names.values()].filter((v) => v > 1).reduce((a, b) => a + b, 0);
    return { distinct: names.size, total: [...names.values()].reduce((a, b) => a + b, 0), duplicated, worst };
  });
  console.log(
    `PROBE candidateList controls=${shared.total} distinctNames=${shared.distinct} sharingAName=${shared.duplicated}`,
  );
  for (const [n, c] of shared.worst) console.log(`  SHARED x${c} "${n.slice(0, 44)}"`);

  const req = ROUTES.find((r) => r.id === 'recruit-requisition-record');
  if (req !== undefined) {
    const p = resolvePath(req, ids);
    if (p !== null) {
      await gotoAsSignedIn(page, p);
      await page.waitForTimeout(2500);
      const short = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.shortlist-btn')).map(
          (n) => n.getAttribute('aria-label') ?? '',
        );
        return { count: labels.length, distinct: new Set(labels).size };
      });
      console.log(`PROBE shortlistButtons=${short.count} distinctNames=${short.distinct}`);
      expect(short.distinct).toBe(short.count);
    }
  }
  expect(shared.total).toBeGreaterThan(0);
  expect(shared.duplicated, 'no row-level control may share its name with another row').toBe(0);
});
