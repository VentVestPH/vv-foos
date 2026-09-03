import { test, expect } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const CANDIDATES = '/recruit/candidates';

async function restCalls(page: import('@playwright/test').Page, run: () => Promise<void>) {
  const seen: string[] = [];
  const listen = (r: { url: () => string }) => {
    const u = r.url();
    if (u.includes('/rest/v1/')) seen.push(u.replace(/^.*\/rest\/v1\//, ''));
  };
  page.on('request', listen);
  await run();
  page.off('request', listen);
  return seen;
}

test.describe('the candidate list pages in the database, not the browser', () => {
  test('it never pages the whole table into the browser', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    const calls = await restCalls(page, async () => {
      await gotoAsSignedIn(page, CANDIDATES);
      await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1500);
    });

    const unbounded = calls.filter(
      (c) =>
        /^(people|candidate_profiles)\?/.test(c) &&
        !c.includes('id=in.') &&
        !c.includes('person_id=in.'),
    );
    expect(
      unbounded,
      'the list must not read people or candidate_profiles without bounding them; that is the fetch-everything pattern this replaced',
    ).toEqual([]);

    const listCalls = calls.filter((c) => c.startsWith('candidate_list?'));
    expect(listCalls.length, 'the list reads the candidate_list view').toBeGreaterThan(0);
    for (const c of listCalls) {
      expect(c, 'every view read carries an explicit range').toMatch(/offset=|limit=/);
    }
  });

  test('the pager count comes from the database and paging moves the rows', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATES);
    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 30000 });

    const label = await page.locator('.fo-pager-count').first().innerText();
    const m = /(\d+)-(\d+) of (\d+)/.exec(label.replace(/,/g, ''));
    expect(m, `the pager should read "from-to of total", got "${label}"`).not.toBeNull();
    const total = Number(m![3]);
    const shown = await rows.count();
    expect(shown).toBeLessThanOrEqual(total);

    if (total > shown) {
      const firstBefore = (await rows.first().locator('.link-btn').innerText()).trim();
      await page.getByRole('button', { name: 'Next page' }).first().click();
      await expect(async () => {
        const firstAfter = (await rows.first().locator('.link-btn').innerText()).trim();
        expect(firstAfter).not.toBe(firstBefore);
      }).toPass({ timeout: 15000 });
      const secondLabel = await page.locator('.fo-pager-count').first().innerText();
      expect(secondLabel.replace(/,/g, '')).toMatch(new RegExp(`of ${total}$`));
    }
  });

  test('a filter narrows the database count, not just the visible rows', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, CANDIDATES);
    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 30000 });

    const totalOf = async () => {
      const label = await page.locator('.fo-pager-count').first().innerText();
      const m = /of (\d+)/.exec(label.replace(/,/g, ''));
      return m ? Number(m[1]) : -1;
    };
    const before = await totalOf();
    expect(before).toBeGreaterThan(1);

    const term = (await rows.first().locator('.link-btn').innerText()).trim().split(' ')[0] ?? '';
    expect(term.length).toBeGreaterThan(2);

    await page.getByRole('searchbox', { name: 'Search Candidates' }).fill(term);

    await expect
      .poll(totalOf, {
        timeout: 20000,
        message: `the database count should drop below ${before} once "${term}" is searched`,
      })
      .toBeLessThan(before);

    const after = await totalOf();
    expect(after).toBeGreaterThan(0);

    const names = await rows.locator('.link-btn').allInnerTexts();
    expect(
      names.some((n) => n.toLowerCase().includes(term.toLowerCase())),
      'the row the search term came from should still be present',
    ).toBe(true);

    expect(
      await rows.count(),
      'a filtered page still shows at most one page of rows',
    ).toBeLessThanOrEqual(20);
  });
});
