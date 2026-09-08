import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const PHONE = { width: 390, height: 844 };

const ROUTES = [
  ['dashboard', '/'],
  ['candidates', '/recruit/candidates'],
  ['candidate record', '/recruit/candidates/b0000000-0000-4000-8000-000000000002'],
  ['requisitions', '/recruit/requisitions'],
  ['deals', '/sales/deals'],
  ['intake', '/intake'],
  ['search', '/search?q=an'],
] as const;

async function settleLayout(page: Page, label: string, capMs = 20000): Promise<void> {
  await page
    .locator('.table-wrap, .kanban, .record-page, .intake-queue, main, [role="main"]')
    .first()
    .waitFor({ state: 'visible', timeout: capMs })
    .catch(() => undefined);

  const read = () =>
    page.evaluate(() => {
      const de = document.documentElement;
      return `${de.scrollWidth}x${de.clientWidth}`;
    });

  const deadline = Date.now() + capMs;
  let previous = await read();
  let stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(150);
    const current = await read();
    stable = current === previous ? stable + 1 : 0;
    previous = current;
    if (stable >= 3) return;
  }
  throw new Error(
    `${label}: the layout never settled within ${capMs}ms, last read ${previous}. ` +
      'Measuring now would report a mid-layout width as an overflow, which is how ' +
      'this check produced a false 43px on seven routes under gate load.',
  );
}

test.describe('Q8: usable on a phone', () => {
  test('no route scrolls the page sideways at 390px', async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(PHONE);
    await signIn(page, PERSONA_EMAILS.admin);

    const offenders: string[] = [];
    for (const [name, path] of ROUTES) {
      await gotoAsSignedIn(page, path);
      await settleLayout(page, name);
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return {
          amount: Math.max(0, de.scrollWidth - de.clientWidth),
          culprits: [...document.querySelectorAll('body *')]
            .filter((el) => {
              const inNav = el.closest('nav.fo-primary-nav') !== null;
              const insideWrap = !el.matches('.table-wrap') && el.closest('.table-wrap') !== null;
              if (inNav || insideWrap) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.right > window.innerWidth + 2;
            })
            .slice(0, 3)
            .map(
              (el) =>
                `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 30)}` +
                `@${Math.round(el.getBoundingClientRect().right)}`,
            ),
        };
      });
      if (overflow.amount > 0) {
        offenders.push(`${name}: ${overflow.amount}px, e.g. ${overflow.culprits.join(', ')}`);
      }
    }
    expect(offenders, 'a phone must not scroll sideways').toEqual([]);
  });

  test('the content starts in the top third of the screen, not below the fold', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap').first()).toBeVisible({ timeout: 25000 });

    const top = await page.evaluate(
      () => Math.round(document.querySelector('main')?.getBoundingClientRect().top ?? 0),
    );
    expect(top, 'header, nav and sidebar must not eat the screen').toBeLessThan(PHONE.height / 3);
  });

  test('the sidebar starts collapsed on a phone and still opens', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');

    const sidebar = page.locator('.fo-sidebar');
    await expect(sidebar).toHaveClass(/collapsed/, { timeout: 25000 });

    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
    await expect(page.getByLabel('Candidate keywords')).toBeVisible();
  });

  test('the sidebar still starts open on a desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.fo-sidebar')).not.toHaveClass(/collapsed/, { timeout: 25000 });
  });

  test('a wide table scrolls inside its own box rather than the page', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const wrap = page.locator('.table-wrap').first();
    await expect(wrap).toBeVisible({ timeout: 25000 });

    const box = await wrap.evaluate((el) => ({
      scrolls: el.scrollWidth > el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
      withinViewport: el.getBoundingClientRect().right <= window.innerWidth + 2,
    }));
    expect(box.overflowX === 'auto' || box.overflowX === 'scroll').toBe(true);
    expect(box.withinViewport, 'the table box itself must fit the screen').toBe(true);
  });
});
