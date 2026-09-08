import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const ROUTES = [
  ['dashboard', '/', true],
  ['pipeline', '/pipeline', true],
  ['candidate record', '/recruit/candidates/b0000000-0000-4000-8000-000000000002', true],
  ['requisition record', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001', true],
  ['candidates', '/recruit/candidates', false],
] as const;

async function expandEverything(page: import('@playwright/test').Page, hasSections = true) {
  if (!hasSections) {
    await expect(page.locator('.table, .kanban').first()).toBeVisible({ timeout: 25000 });
    return;
  }
  await expect(page.locator('.record-section').first()).toBeVisible({ timeout: 25000 });
  const shut = page.locator('.record-section-header[aria-expanded="false"]');
  for (let guard = 0; guard < 40; guard += 1) {
    const n = await shut.count();
    if (n === 0) return;
    await shut.first().click();
    await expect
      .poll(() => shut.count(), { timeout: 10000, message: 'a section never opened' })
      .toBeLessThan(n);
  }
}

test('K16: expanding accordions never adds a second, document-level scrollbar', async ({
  page,
}) => {
  test.setTimeout(180000);
  await signIn(page, PERSONA_EMAILS.admin);
  const offenders: string[] = [];

  for (const [name, path, hasSections] of ROUTES) {
    await gotoAsSignedIn(page, path);
    await expect(page.locator('main')).toBeVisible({ timeout: 25000 });
    await expandEverything(page, hasSections);

    const state = await page.evaluate(() => {
      const de = document.documentElement;
      window.scrollTo(0, 400);
      const moved = window.scrollY;
      window.scrollTo(0, 0);
      const stretchers = Array.from(document.querySelectorAll('body *'))
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.position !== 'absolute') return false;
          const r = el.getBoundingClientRect();
          return r.height > 0 && r.bottom > window.innerHeight + 2;
        })
        .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 24)}`)
        .slice(0, 3);
      const main = document.querySelector('main');
      return {
        docOverflow: de.scrollHeight - de.clientHeight,
        moved,
        stretchers,
        mainScrolls: main ? main.scrollHeight > main.clientHeight : false,
      };
    });

    if (state.docOverflow > 0 || state.moved > 0) {
      offenders.push(
        `${name}: document overflows by ${state.docOverflow}px and scrolled to ${state.moved}` +
          (state.stretchers.length ? `, stretched by ${state.stretchers.join(', ')}` : ''),
      );
    }
  }

  expect(
    offenders,
    'main.shell-content is the only scroller; a document scrollbar is the K16 defect',
  ).toEqual([]);
});

test('the tall record page still scrolls inside main, so nothing is unreachable', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates/b0000000-0000-4000-8000-000000000002');
  await expect(page.locator('main')).toBeVisible({ timeout: 25000 });
  await expandEverything(page);
  const reach = await page.locator('main').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    const atBottom = el.scrollTop > 0;
    el.scrollTop = 0;
    return { scrollable: el.scrollHeight > el.clientHeight, atBottom };
  });
  expect(reach.scrollable, 'the tall page must scroll somewhere').toBe(true);
  expect(reach.atBottom, 'main must be the scroller that reaches the bottom').toBe(true);
});
