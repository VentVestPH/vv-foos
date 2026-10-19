import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, openFilterRail, signIn } from './helpers';

const HINT_MIN_CHARS = 3;
const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const FIRST = `Qsfirst${RUN}`;
const MIDDLE = `Qsmiddle${RUN}`;
const LAST = `Qslast${RUN}`;

let person = '';
let emailPerson = '';
const EMAIL_TERM = `qsmatch${RUN}`.toLowerCase();
const VIEW_NAME = `Qsview${RUN}`;

async function headers(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.table-wrap thead th')]
      .map((th) => (th.textContent ?? '').trim())
      .filter((text) => text !== ''),
  );
}

const LIST_ROUTES: [string, string][] = [
  ['candidates', '/recruit/candidates'],
  ['requisitions', '/recruit/requisitions'],
  ['companies', '/sales/companies'],
  ['contacts', '/sales/contacts'],
  ['deals', '/sales/deals'],
  ['tickets', '/sales/tickets'],
  ['intake queue', '/intake'],
];

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('people')
    .insert({ first_name: FIRST, middle_name: MIDDLE, last_name: LAST, is_test: true })
    .select('id')
    .single();
  if (error) throw error;
  person = data.id;
  const profile = await admin.from('candidate_profiles').insert({ person_id: person });
  if (profile.error) throw profile.error;

  const byEmail = await admin
    .from('people')
    .insert({
      first_name: 'Qsmailfirst',
      last_name: `Qsmaillast${RUN}`,
      emails: [{ address: `${EMAIL_TERM}@example.test` }],
      is_test: true,
    })
    .select('id')
    .single();
  if (byEmail.error) throw byEmail.error;
  emailPerson = byEmail.data.id;
  const emailProfile = await admin.from('candidate_profiles').insert({ person_id: emailPerson });
  if (emailProfile.error) throw emailProfile.error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('ats_saved_views').delete().eq('name', VIEW_NAME);
  await admin.from('candidate_profiles').delete().eq('person_id', person);
  await admin.from('candidate_profiles').delete().eq('person_id', emailPerson);
  await admin.from('people').delete().eq('id', emailPerson);
  const { error } = await admin.from('people').delete().eq('id', person);
  if (error) throw new Error(`could not remove the quick-search fixture: ${error.message}`);
});

test.describe('Q: the sidebar quick search reaches the list it navigates to', () => {
  test('Q1: every list page seeds its search box from the search parameter', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    for (const [label, route] of LIST_ROUTES) {
      await gotoAsSignedIn(page, `${route}?search=${encodeURIComponent(FIRST)}`);
      const box = page.locator('.list-page-search input');
      await expect(box, `${label} must have a search box for the sidebar to reach`).toHaveCount(1);
      await expect(box, `${label} dropped the term the sidebar navigated with`).toHaveValue(FIRST);
    }
  });

  test('Q2: a first and last name typed into the list search finds the candidate', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.list-page-search input');

    const box = page.locator('.list-page-search input');
    await box.fill(`${FIRST} ${LAST}`);
    await box.press('Enter');

    await expect(
      page.getByRole('button', { name: `${FIRST} ${MIDDLE} ${LAST}`, exact: true }),
      'a first and last name must match even with a middle name between them',
    ).toBeVisible({ timeout: 15000 });
  });

  test('Q3: the words of a search are ANDed, not matched as one string', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates?search=${encodeURIComponent(`${LAST} ${FIRST}`)}`);
    await expect(
      page.getByRole('button', { name: `${FIRST} ${MIDDLE} ${LAST}`, exact: true }),
      'the words may arrive in any order',
    ).toBeVisible({ timeout: 15000 });

    await gotoAsSignedIn(page, `/recruit/candidates?search=${encodeURIComponent(`${FIRST} Nomatch${RUN}`)}`);
    await expect(page.locator('.table-empty'), 'every word has to match').toBeVisible({
      timeout: 15000,
    });
  });
});

test.describe('Q: the candidate list header holds its own controls', () => {
  test('Q4: the toolbar is joined to the page head and sticks', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.list-page-search input');

    const shape = await page.evaluate(() => {
      const head = document.querySelector('.fo-page-head') as HTMLElement;
      const bar = document.querySelector('.fo-page-toolbar') as HTMLElement;
      return {
        flush: document.querySelector('.list-page')?.getAttribute('data-flush'),
        gap: Math.round(bar.getBoundingClientRect().top - head.getBoundingClientRect().bottom),
        position: getComputedStyle(bar).position,
        borderTop: getComputedStyle(bar).borderTopWidth,
        gearsInHead: document.querySelectorAll(
          '.fo-page-head button[aria-label="Column settings"]',
        ).length,
        looseActionBars: document.querySelectorAll(
          '.list-page-table > .record-action-bar',
        ).length,
      };
    });
    expect(shape.flush, 'the candidate list must sit flush like the requisition list').toBe('true');
    expect(shape.gap, 'the toolbar must join the page head with no gap').toBe(0);
    expect(shape.position).toBe('sticky');
    expect(shape.borderTop, 'a joined toolbar draws no second border').toBe('0px');
    expect(shape.gearsInHead, 'column settings belongs in the page head').toBe(1);
    expect(shape.looseActionBars, 'no action bar may sit loose above the table').toBe(0);
  });

  test('Q5: the action buttons grow in only once a row is ticked', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const grow = page.locator('.fo-page-toolbar .fo-page-head-grow');
    await expect(grow, 'the bulk bar belongs inside the sticky head').toHaveCount(1);
    await expect(grow).toHaveAttribute('data-open', 'false');
    expect(
      await grow.locator('.fo-page-head-grow-inner').evaluate((el) => el.clientHeight),
      'nothing may take height while no row is selected',
    ).toBe(0);

    const box = page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]');
    await box.check();
    await expect(grow).toHaveAttribute('data-open', 'true');
    await expect
      .poll(async () =>
        grow.locator('.fo-page-head-grow-inner').evaluate((el) => el.clientHeight),
      )
      .toBeGreaterThan(0);

    await box.uncheck();
    await expect(grow).toHaveAttribute('data-open', 'false');
    await expect
      .poll(async () =>
        grow.locator('.fo-page-head-grow-inner').evaluate((el) => el.clientHeight),
      )
      .toBe(0);
  });

  test('Q6: one flag column, and it carries the do-not-contact flag', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const flagHeaders = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.table-wrap thead th'))
        .map(
          (th) =>
            (th as HTMLElement).innerText.trim() ||
            th.querySelector('[role="img"]')?.getAttribute('aria-label') ||
            '',
        )
        .filter((t) => /flag/i.test(t)),
    );
    expect(flagHeaders, 'a second flag column that renders nothing is not a column').toEqual([
      'Flags',
    ]);

    const admin = await clientAs('admin');
    const { error } = await admin
      .from('candidate_profiles')
      .update({ do_not_contact: true })
      .eq('person_id', person);
    expect(error).toBeNull();

    await gotoAsSignedIn(page, `/recruit/candidates?search=${encodeURIComponent(FIRST)}`);
    await expect(
      page.getByRole('img', { name: 'Do not contact' }),
      'the surviving flag column must show the flag it is named for',
    ).toBeVisible({ timeout: 15000 });

    await admin.from('candidate_profiles').update({ do_not_contact: false }).eq('person_id', person);
  });

  test('Q9: a saved view keeps the candidate column order and what is hidden', async ({ page }) => {
    test.setTimeout(120000);
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    const before = await headers(page);

    await page.getByRole('button', { name: 'Column settings' }).click();
    const rows = page.locator('.fo-column-row');
    await expect(rows.first()).toBeVisible({ timeout: 15000 });

    const second = (await rows.nth(1).innerText()).trim();
    await rows.nth(1).locator('.fo-column-grip').focus();
    await page.keyboard.press('ArrowUp');
    await expect(rows.first()).toContainText(second);

    const dropped = (await rows.last().innerText()).trim();
    await rows.last().getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Done' }).click();

    const arranged = await headers(page);
    expect(arranged, 'the hidden column left the table').not.toContain(dropped);

    await page.getByRole('button', { name: 'Save view' }).click();
    const save = page.getByRole('dialog', { name: 'Save view' });
    await save.getByLabel('View name').fill(VIEW_NAME);
    await save.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(save).toHaveCount(0);

    await page.getByRole('button', { name: 'Column settings' }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    expect(await headers(page), 'Reset undoes the arrangement first').toEqual(before);

    await chooseOption(page, page.getByLabel('Saved views'), VIEW_NAME);
    await expect
      .poll(async () => headers(page), {
        message: 'applying the view has to restore both the order and the hidden column',
        timeout: 20000,
      })
      .toEqual(arranged);
  });

  test('Q7: the search row is never replaced by a skeleton', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.route('**/candidate_list*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });

    const navigation = page.goto('/recruit/candidates');
    await page.waitForSelector('.fo-skeleton-card .skeleton-row', { timeout: 10000 });
    const head = await page.evaluate(() => ({
      toolbarSkeletons: document.querySelectorAll('.fo-page-toolbar .skeleton').length,
      searchBox: document.querySelectorAll('.list-page-search input').length,
      tableSkeleton: document.querySelectorAll('.fo-skeleton-card .skeleton-row').length,
      title: (document.querySelector('.fo-page-head h1') as HTMLElement)?.innerText,
    }));
    expect(
      head.toolbarSkeletons,
      'the search row must stay usable while the table loads',
    ).toBe(0);
    expect(head.searchBox, 'the box itself has to be there to type into').toBe(1);
    expect(head.tableSkeleton, 'the table is what loads, so the table is what skeletons').toBe(8);
    expect(head.title).toBe('Candidates');

    await navigation;
    await page.unroute('**/candidate_list*');
  });

  test('Q10b: a suggestion that matched only on email says so, so the row never looks unrelated to the term', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.locator('.list-page-search input').pressSequentially(EMAIL_TERM, { delay: 30 });

    const hint = page.locator('.fo-hint').filter({ hasText: `Qsmaillast${RUN}` });
    await expect(hint).toBeVisible({ timeout: 15000 });
    await expect(hint.locator('.fo-hint-primary')).not.toContainText(EMAIL_TERM);
    await expect(hint.locator('.fo-hint-meta')).toHaveText(`Matched: ${EMAIL_TERM}@example.test`);
  });

  test('Q10: the list search suggests records from its own list', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    for (const [route, prefix, noun] of [
      ['/recruit/requisitions', '/recruit/requisitions/', 'requisitions'],
      ['/recruit/candidates', '/recruit/candidates/', 'candidates'],
    ] as const) {
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.table-wrap tbody tr');
      const firstRow = (
        await page.locator('.table-wrap tbody tr .link-btn').first().innerText()
      ).trim();
      const term = (
        firstRow
          .split(/\s+/)
          .map((word) => word.replace(/[^A-Za-z]/g, ''))
          .find((word) => word.length >= HINT_MIN_CHARS) ?? ''
      ).slice(0, 4);
      expect(
        term.length,
        `${route}: the suggestion term is taken from a row the list is already showing, because a hardcoded one matches nothing on a freshly seeded database`,
      ).toBeGreaterThanOrEqual(HINT_MIN_CHARS);
      await page.locator('.list-page-search input').pressSequentially(term, { delay: 30 });

      const pop = page.locator('.fo-hint-pop');
      await expect(pop, `${route} offers no suggestions`).toBeVisible({ timeout: 15000 });
      const shape = await page.evaluate(() => {
        const el = document.querySelector('.fo-hint-pop') as HTMLElement;
        const input = document.querySelector('.list-page-search input') as HTMLElement;
        return {
          hints: el.querySelectorAll('.fo-hint').length,
          hrefs: Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? ''),
          all: (el.querySelector('.fo-hint-all-btn') as HTMLElement)?.innerText ?? '',
          belowTrigger: Math.round(
            el.getBoundingClientRect().top - input.getBoundingClientRect().bottom,
          ),
        };
      });
      expect(shape.hints, `${route} suggested nothing`).toBeGreaterThan(0);
      expect(
        shape.hrefs.every((href) => href.startsWith(prefix)),
        `${route} must suggest only its own records, got ${shape.hrefs.join(' ')}`,
      ).toBe(true);
      expect(shape.all, 'the footer names the list, not everything').toContain(noun);
      expect(
        Math.abs(shape.belowTrigger),
        `the pop sits against the box, not adrift; it was ${shape.belowTrigger}px away`,
      ).toBeLessThanOrEqual(4);
    }
  });

  test('Q11: the four columns that had no sort now have one', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const labels = ['Flags', 'Requisitions', 'Resume', 'Grade comment'];
    for (const label of labels) {
      const index = await page.evaluate(
        (name) =>
          Array.from(document.querySelectorAll('.table-wrap thead th')).findIndex(
            (th) =>
              ((th as HTMLElement).innerText.trim() ||
                th.querySelector('[role="img"]')?.getAttribute('aria-label') ||
                '') === name,
          ),
        label,
      );
      expect(index, `${label} is not in the table`).toBeGreaterThan(-1);
      const header = page.locator('.table-wrap thead th').nth(index);
      await expect(header, `${label} must be sortable`).toHaveClass(/sortable/);
      await header.locator('button').first().click();
      await expect
        .poll(async () => header.getAttribute('aria-sort'), {
          message: `${label} must report a direction once sorted`,
          timeout: 15000,
        })
        .toBe('ascending');
      await expect
        .poll(async () => page.locator('.table-wrap tbody tr').count(), {
          message: `${label} sorted server-side must still return rows`,
          timeout: 15000,
        })
        .toBeGreaterThan(0);
    }
  });
});

test.describe('Q: links do not underline on hover', () => {
  const ROUTES = ['/', '/recruit/candidates', '/recruit/requisitions', '/sales/deals'];

  test('Q8: no anchor picks up an underline when pointed at', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    for (const route of ROUTES) {
      await gotoAsSignedIn(page, route);
      const rules = await page.evaluate(() => {
        const out: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRule[];
          try {
            rules = Array.from(sheet.cssRules);
          } catch {
            continue;
          }
          const walk = (list: CSSRule[]) => {
            for (const rule of list) {
              if ('cssRules' in rule) walk(Array.from((rule as CSSGroupingRule).cssRules));
              const style = (rule as CSSStyleRule).style;
              const selector = (rule as CSSStyleRule).selectorText;
              if (!style || !selector) continue;
              if (!/:hover/.test(selector)) continue;
              if (!/(^|[\s,>+~])a(?![\w-])/.test(selector)) continue;
              if (style.getPropertyValue('text-decoration-line') === 'underline') {
                out.push(selector);
              }
              if (/underline/.test(style.getPropertyValue('text-decoration'))) out.push(selector);
            }
          };
          walk(rules);
        }
        return [...new Set(out)];
      });
      expect(rules, `${route} still underlines an anchor on hover`).toEqual([]);
    }
  });
});

test.describe('Q: the list search only runs when submitted', () => {
  test('Q13: typing suggests but does not filter; Enter and the glass do', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const listReads: string[] = [];
    const hintReads: string[] = [];
    await page.route('**/rest/v1/candidate_list?*', async (route) => {
      const url = route.request().url();
      if (url.includes('search_text')) {
        (url.includes('limit=10') ? hintReads : listReads).push(url);
      }
      await route.continue().catch(() => undefined);
    });

    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const box = page.locator('.list-page-search input');
    await box.pressSequentially(FIRST.slice(0, 8), { delay: 100 });
    await page.waitForTimeout(2500);

    expect(listReads, 'no keystroke may filter the table').toEqual([]);
    expect(hintReads.length, 'but the suggestions still run').toBeGreaterThan(0);
    await expect(
      page.locator('.fo-hint-pop'),
      'and they are on screen while typing',
    ).toBeVisible();

    await box.press('Enter');
    await expect
      .poll(() => listReads.length, { timeout: 10000, message: 'Enter runs the search' })
      .toBeGreaterThan(0);
    await expect(
      page.locator('.fo-hint-pop'),
      'Enter must dismiss the suggestions, not leave them over the results',
    ).toHaveCount(0);

    const afterEnter = listReads.length;
    await box.fill(FIRST);
    await page.locator('.list-page-search .fo-searchbox-submit').click();
    await expect
      .poll(() => listReads.length, { timeout: 10000, message: 'the glass runs it too' })
      .toBeGreaterThan(afterEnter);

    await page.unroute('**/rest/v1/candidate_list?*');
  });

  test('Q14: the X clears the box, refocuses it and restores the list', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const box = page.locator('.list-page-search input');
    const clear = page.locator('.list-page-search .fo-searchbox-clear');
    await expect(clear, 'nothing to clear while the box is empty').toHaveCount(0);
    const unfiltered = await page.locator('.table-wrap tbody tr').count();

    await box.fill(FIRST);
    await expect(clear).toBeVisible();
    const layout = await page.evaluate(() => {
      const wrap = document.querySelector(
        '.list-page-search .fo-search-input-wrap',
      ) as HTMLElement;
      const x = wrap.querySelector('.fo-searchbox-clear') as HTMLElement;
      const glass = wrap.querySelector('.fo-searchbox-submit') as HTMLElement;
      return {
        gap: Math.round(glass.getBoundingClientRect().left - x.getBoundingClientRect().right),
        xIsLeftOfGlass:
          x.getBoundingClientRect().left < glass.getBoundingClientRect().left,
        padRight: getComputedStyle(wrap.querySelector('input') as HTMLElement).paddingRight,
      };
    });
    expect(layout.xIsLeftOfGlass, 'the X sits beside the magnifying glass').toBe(true);
    expect(layout.gap, 'and does not overlap it').toBe(0);
    expect(layout.padRight, 'the text must not run under either control').toBe('62px');

    await box.press('Enter');
    const filtered = await page.locator('.table-wrap tbody tr').count();
    expect(filtered).toBeGreaterThan(0);

    await clear.click();
    await expect(box).toHaveValue('');
    await expect(clear, 'the X goes away with the text').toHaveCount(0);
    expect(
      await box.evaluate((el) => el === document.activeElement),
      'clearing leaves the cursor in the box so you can type again',
    ).toBe(true);
    await expect
      .poll(async () => page.locator('.table-wrap tbody tr').count(), {
        timeout: 15000,
        message: 'clearing puts the unfiltered list back',
      })
      .toBe(unfiltered);
  });

  test('Q15: the resume column is centred', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const geom = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('.table-wrap thead th'));
      const i = ths.findIndex((th) => (th as HTMLElement).innerText.trim() === 'Resume');
      const th = ths[i] as HTMLElement;
      const td = document.querySelectorAll('.table-wrap tbody tr')[0]?.children[i] as HTMLElement;
      const icon = td.querySelector('[role="img"]') as HTMLElement;
      const cell = td.getBoundingClientRect();
      const mark = icon.getBoundingClientRect();
      return {
        thAlign: getComputedStyle(th).textAlign,
        left: Math.round(mark.left - cell.left),
        right: Math.round(cell.right - mark.right),
      };
    });
    expect(geom.thAlign, 'the header is centred over its column').toBe('center');
    expect(
      Math.abs(geom.left - geom.right),
      `the resume icon must sit in the middle of its cell; it was ${geom.left}px from the left and ${geom.right}px from the right`,
    ).toBeLessThanOrEqual(2);
  });
});

test.describe('Q: the grade comment column', () => {
  test('Q19: Edit sits in the same place whether or not there is a comment', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const shape = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.grade-comment-cell')) as HTMLElement[];
      const rows = cells.map((cell) => {
        const edit = cell.querySelector('button.btn') as HTMLElement | null;
        const slot = cell.querySelector('.grade-comment-text') as HTMLElement | null;
        return {
          hasSlot: slot !== null,
          filled: (slot?.innerText.trim() ?? '') !== '' && (slot?.innerText.trim() ?? '') !== '\u2014',
          editLeft: edit === null ? null : Math.round(edit.getBoundingClientRect().left),
        };
      });
      return {
        cells: rows.length,
        slots: rows.filter((r) => r.hasSlot).length,
        filled: rows.filter((r) => r.filled).length,
        blank: rows.filter((r) => !r.filled).length,
        editColumns: [...new Set(rows.map((r) => r.editLeft).filter((v) => v !== null))],
      };
    });

    expect(shape.cells, 'the grade comment column has to be on screen').toBeGreaterThan(0);
    expect(
      shape.slots,
      'every cell renders a text slot, even when empty, or the flex child vanishes and Edit slides left',
    ).toBe(shape.cells);
    expect(
      shape.blank,
      'this test needs at least one candidate with no grade comment to mean anything',
    ).toBeGreaterThan(0);
    expect(
      shape.editColumns.length,
      `every Edit must share one left edge; got ${shape.editColumns.join(', ')}`,
    ).toBe(1);
  });
});

test.describe('Q: the search controls are the same everywhere', () => {
  test('Q16: every search box gets a clear button, positioned for its own controls', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const shapeOf = async (selector: string) => {
      await page.locator(selector).fill('adam');
      return page.evaluate((sel) => {
        const input = document.querySelector(sel) as HTMLInputElement;
        const wrap = input.closest('.fo-search-input-wrap') as HTMLElement;
        const x = wrap.querySelector('.fo-searchbox-clear') as HTMLElement | null;
        const glass = wrap.querySelector('.fo-searchbox-submit') as HTMLElement | null;
        return {
          hasX: x !== null,
          hasGlass: glass !== null,
          xFromRight: x
            ? Math.round(wrap.getBoundingClientRect().right - x.getBoundingClientRect().right)
            : null,
          padRight: getComputedStyle(input).paddingRight,
        };
      }, selector);
    };

    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.list-page-search input');
    const list = await shapeOf('.list-page-search input');
    expect(list.hasX, 'the list toolbar box needs one').toBe(true);
    expect(list.xFromRight, 'and it sits beside the glass, not on top of it').toBe(30);
    expect(list.padRight).toBe('62px');

    const header = await shapeOf('.fo-utility-search input');
    expect(header.hasX, 'the utility header box needs one too').toBe(true);
    expect(header.xFromRight).toBe(30);

    await gotoAsSignedIn(page, '/search');
    await page.waitForSelector('.fo-search-block input');
    const global = await shapeOf('.fo-search-block input');
    expect(global.hasX, 'so does the global search page').toBe(true);
    expect(
      global.hasGlass,
      'that page supplies its own Search button instead of the inset glass',
    ).toBe(false);
    expect(
      global.xFromRight,
      'so the X takes the right edge rather than leaving a gap',
    ).toBe(0);
    expect(global.padRight, 'and the inset shrinks to one control').toBe('30px');
  });

  test('Q17: the sidebar keeps only Search everything and Advanced Search', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    for (const route of ['/recruit/candidates', '/recruit/requisitions', '/sales/deals']) {
      await gotoAsSignedIn(page, route);
      const sidebar = page.locator('.fo-sidebar');
      await expect(sidebar).toBeVisible();
      expect(
        await sidebar.locator('input').count(),
        `${route}: the sidebar has no search inputs of its own any more; the list toolbar owns that`,
      ).toBe(0);
      await expect(sidebar.getByRole('button', { name: 'Search everything' })).toBeVisible();
      await expect(sidebar.getByRole('button', { name: 'Advanced Search' })).toBeVisible();
      await expect(sidebar, 'no Keywords label survives').not.toContainText('Keywords');
    }
  });

  test('Q18: Name and Sourcer do not wrap, and Location has room', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');

    const cells = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('.table-wrap thead th'));
      const row = document.querySelectorAll('.table-wrap tbody tr')[0]!;
      const read = (name: string) => {
        const i = ths.findIndex((th) => (th as HTMLElement).innerText.trim() === name);
        const td = row.children[i] as HTMLElement;
        return {
          whiteSpace: getComputedStyle(td).whiteSpace,
          width: Math.round(td.getBoundingClientRect().width),
        };
      };
      const wrap = document.querySelector('.table-wrap') as HTMLElement;
      return {
        name: read('Name'),
        sourcer: read('Sourcer'),
        location: read('Location'),
        overflowX: getComputedStyle(wrap).overflowX,
        documentScrollsSideways:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    expect(cells.name.whiteSpace, 'a candidate name must stay on one line').toBe('nowrap');
    expect(cells.sourcer.whiteSpace, 'and so must the sourcer').toBe('nowrap');
    expect(
      cells.location.width,
      `Location was 106px and wrapped; it must hold its 200px minimum, got ${cells.location.width}px`,
    ).toBeGreaterThanOrEqual(200);
    expect(
      cells.overflowX,
      'the table scrolls sideways in its own wrapper, which is what makes nowrap safe',
    ).toBe('auto');
    expect(
      cells.documentScrollsSideways,
      'and the page itself must still not scroll sideways',
    ).toBe(false);
  });
});

test.describe('Q: submitting a list search stays on the list', () => {
  test('Q12: the magnifying glass in a list toolbar does not jump to global search', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    for (const route of ['/recruit/candidates', '/recruit/requisitions', '/sales/deals']) {
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.list-page-search input');
      await page.locator('.list-page-search input').fill('zzz');
      await page.locator('.list-page-search .fo-searchbox-submit').click();
      await page.waitForTimeout(600);
      expect(page.url(), `${route} left the list on submit`).toContain(route);
    }
  });
});

test('Q20: Export is clickable from first paint, not after the count arrives', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await page.route('**/rest/v1/candidate_list*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await gotoAsSignedIn(page, '/recruit/candidates');

  const button = page.getByRole('button', { name: 'Export' });
  await expect(button).toBeVisible({ timeout: 20000 });
  await expect(
    button,
    'the count starts at 0 while the first page is still in flight, and a control that disables itself for a second reads as broken',
  ).toBeEnabled();
  await page.unroute('**/rest/v1/candidate_list*');
});

test.describe('FOOSBR-10: first and last name filters in the candidate Advanced Search', () => {
  test('First name and Last name narrow the list on Enter, and Clear filters empties them', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await openFilterRail(page);
    const rail = page.locator('.filter-rail');
    const rows = page.locator('.table-wrap tbody tr');

    await rail.getByLabel('First name').fill(FIRST);
    await rail.getByLabel('First name').press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 20000 });
    await expect(rows.first()).toContainText(LAST);

    await rail.getByLabel('Last name').fill(`${LAST}zz`);
    await rail.getByLabel('Last name').press('Enter');
    await expect(rows.filter({ hasText: LAST })).toHaveCount(0, { timeout: 20000 });

    await rail.getByLabel('Last name').fill(LAST);
    await rail.getByLabel('Last name').press('Enter');
    await expect(rows).toHaveCount(1, { timeout: 20000 });

    await rail.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rail.getByLabel('First name')).toHaveValue('');
    await expect(rail.getByLabel('Last name')).toHaveValue('');
    await expect(rows).not.toHaveCount(1, { timeout: 20000 });
  });
});
