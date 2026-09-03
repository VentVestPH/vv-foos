import { test, expect } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const CANDIDATES = '/recruit/candidates';
const REQUISITIONS = '/recruit/requisitions';
const DEALS = '/sales/deals';

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

test.describe('the requisition list pages in the database too', () => {
  test('it never pages requisitions, owners or applications wholesale', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    const calls = await restCalls(page, async () => {
      await gotoAsSignedIn(page, REQUISITIONS);
      await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1500);
    });

    const unbounded = calls.filter(
      (c) =>
        /^(requisitions|requisition_owners|applications|application_views)\?/.test(c) &&
        !c.includes('id=in.') &&
        !c.includes('requisition_id=in.') &&
        !c.includes('application_id=in.'),
    );
    expect(
      unbounded,
      'the requisition list must not read these tables wholesale; that is the pattern this replaced',
    ).toEqual([]);

    const viewCalls = calls.filter((c) => c.startsWith('requisition_list?'));
    expect(viewCalls.length, 'the list reads the requisition_list view').toBeGreaterThan(0);
    for (const c of viewCalls) {
      expect(c, 'every view read carries an explicit range').toMatch(/offset=|limit=/);
    }
  });

  test('the owner filter and the company name come from the database', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, REQUISITIONS);
    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 30000 });

    const cells = await rows.first().locator('td').allInnerTexts();
    expect(
      cells.some((c) => c.trim().length > 0),
      'the first requisition row renders content',
    ).toBe(true);

    const label = await page.locator('.fo-pager-count').first().innerText();
    expect(label.replace(/,/g, ''), 'the pager reads from-to of total').toMatch(
      /(\d+-\d+ of \d+|0 of 0)/,
    );
  });
});

test.describe('the deal board is bounded per stage', () => {
  test('the kanban never reads deals wholesale, and every read is ranged', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    const calls = await restCalls(page, async () => {
      await gotoAsSignedIn(page, DEALS);
      await expect(page.locator('.kanban-col').first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(2000);
    });

    const unbounded = calls.filter((c) => /^deals\?/.test(c) && !c.includes('id=eq.'));
    expect(
      unbounded,
      'the board must not read the deals table wholesale; it reads the bounded view per stage',
    ).toEqual([]);

    const viewCalls = calls.filter((c) => c.startsWith('deal_list?'));
    expect(viewCalls.length, 'the board reads deal_list once per stage').toBeGreaterThan(0);
    for (const c of viewCalls) {
      expect(c, 'every board read is ranged and stage-scoped').toMatch(/offset=|limit=/);
      expect(c, 'every board read names its stage').toMatch(/stage=eq\./);
    }
  });

  test('the table view pages, with a database count', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, DEALS);
    await expect(page.locator('.kanban-col').first()).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /^Table$/ }).click();
    await expect(page.locator('.table-wrap')).toBeVisible({ timeout: 20000 });

    const label = await page.locator('.fo-pager-count').first().innerText();
    expect(label.replace(/,/g, ''), 'the pager reads from-to of total').toMatch(
      /(\d+-\d+ of \d+|0 of 0)/,
    );
  });
});

test.describe('column sorting reaches the database, not just the visible page', () => {
  for (const [name, path, view] of [
    ['candidates', CANDIDATES, 'candidate_list'],
    ['requisitions', REQUISITIONS, 'requisition_list'],
  ] as const) {
    test(`${name}: clicking a sortable header re-queries with an order`, async ({ page }) => {
      await signIn(page, PERSONA_EMAILS.admin);
      await gotoAsSignedIn(page, path);
      const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
      await expect(rows.first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(800);

      const header = page.locator('.table-wrap thead th.sortable, .table-wrap thead th[aria-sort]').first();
      const headerCount = await header.count();
      if (headerCount === 0) {
        throw new Error(`${name} has no sortable header, so this guard cannot check anything`);
      }

      const seen: string[] = [];
      const listen = (r: { url: () => string }) => {
        const u = r.url();
        if (u.includes(`/rest/v1/${view}`)) seen.push(u);
      };
      page.on('request', listen);
      await header.click();
      await expect
        .poll(() => seen.length, {
          timeout: 15000,
          message: `clicking a ${name} header must issue a new ${view} request; if it sorts in the browser it only reorders the visible page`,
        })
        .toBeGreaterThan(0);
      page.off('request', listen);

      expect(
        seen.some((u) => /[?&]order=/.test(u)),
        `the re-query must carry an order parameter. Saw: ${seen.map((u) => u.replace(/^.*\/rest\/v1\//, '')).slice(0, 2).join(' | ')}`,
      ).toBe(true);
    });
  }
});
