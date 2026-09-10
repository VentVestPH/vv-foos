import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, signIn } from './helpers';
import { clientAs, deleteOwnSettings } from '../env';

const RAIL_NOTE = `QA record-ui ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const RAIL_KEY = 'ui.recentlyViewed';
const RAIL_PERSONA = 'recruiter';

async function resetRail(): Promise<void> {
  for (const persona of ['admin', RAIL_PERSONA] as const) {
    await deleteOwnSettings(persona, [RAIL_KEY]);
  }
}

test.describe('Record and list UI criteria', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
  });

  test.afterEach(async () => {
    const admin = await clientAs('admin');
    await admin.from('activities').delete().like('subject', `${RAIL_NOTE}%`);
    await resetRail();
  });

  test('3.8 the tickets list is read-only, with no working mutation control', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/tickets');
    await expect(page.getByRole('heading', { name: /^Tickets/ })).toBeVisible();
    const newTicket = page.getByRole('button', { name: 'New Ticket', exact: true });
    await expect(newTicket).toBeVisible();
    await newTicket.click();
    await expect(page.locator('.fo-placeholder-modal')).toContainText(
      /still in development/i,
    );
    await expect(
      page.locator('.fo-placeholder-modal'),
      'the copy says what happens next, not just that something is missing',
    ).toContainText(/Customer Success module/i);
    await page.keyboard.press('Escape');
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
    await expect(page.locator('.table-wrap input:not([disabled]), .table-wrap select:not([disabled])')).toHaveCount(0);
    await expect(page.locator('.table-wrap tbody')).toContainText(/No tickets/i);
  });

  test('3.1 a company record shows contacts, deals, requisitions and an activity timeline', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/companies');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/sales\/companies\/[0-9a-f-]{36}/);

    const companyId = new URL(page.url()).pathname.split('/').pop() as string;
    const admin = await clientAs('admin');
    const { error: seedErr } = await admin.from('activities').insert({
      kind: 'note',
      subject: RAIL_NOTE,
      body: 'the side rail collapses when a record has nothing logged, so this test seeds one',
      occurred_at: new Date().toISOString(),
      company_id: companyId,
    });
    expect(seedErr, 'the seeded note must insert').toBeNull();
    await page.reload();

    for (const section of [/Details/, /Contacts \(\d+\)/, /Open deals \(\d+\)/, /Requisitions \(\d+\)/, /Activity/]) {
      await expect(page.getByRole('button', { name: section }).first()).toBeVisible();
    }
    for (const panel of ['Notes', 'Calls', 'Meetings', 'Events', 'Emails']) {
      await expect(
        page.getByRole('tab', { name: new RegExp(`^${panel}`) }),
        `${panel} must be offered as a tab`,
      ).toBeVisible();
    }
    for (const quickAdd of ['+ Note', '+ Call', '+ Task', '+ Reminder']) {
      await expect(page.getByRole('button', { name: quickAdd, exact: true })).toBeVisible();
    }
  });

  test('2.9 and 2.11 the candidate list offers a saved view and a CSV export', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.getByRole('button', { name: 'Save view', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
    await openFilterRail(page);
  });

  test('2.6 and 3.3 the deals board offers both kanban and table views over one dataset', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');

    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 20000 });
    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    const tableRows = await rows.count();
    expect(tableRows).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.locator('.table-wrap table')).toHaveCount(0, { timeout: 20000 });

    const cards = page.locator('.sales-kanban-card');
    await expect
      .poll(() => cards.count(), {
        timeout: 20000,
        message: 'the kanban should show the same number of deals the table did',
      })
      .toBe(tableRows);
  });

  test('2.12 and 3.9 no horizontal page scroll at tablet or desktop width', async ({ page }) => {
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await gotoAsSignedIn(page, '/recruit/candidates');
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.body.clientWidth,
      }));
      expect(scrollWidth, `body scrolls horizontally at ${width}px`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });
});

test.describe('Recently Viewed rail (2.10)', () => {
  test.beforeEach(async ({ page }) => {
    await resetRail();
    await signIn(page, PERSONA_EMAILS[RAIL_PERSONA]);
  });

  test.afterEach(async () => {
    await resetRail();
  });

  test('2.10 the Recently Viewed rail records opens across modules, newest first', async ({ page }) => {
    const rail = page.locator('aside, .fo-sidebar').first();

    await gotoAsSignedIn(page, '/sales/companies');
    const companyLink = page.locator('.table-wrap .link-btn').first();
    const companyLabel = (await companyLink.innerText()).trim();
    await companyLink.click();
    await expect(page).toHaveURL(/\/sales\/companies\/[0-9a-f-]{36}/);
    await expect(rail).toContainText(/Recently Viewed/);
    await expect(rail.getByText(companyLabel, { exact: true })).toBeVisible({ timeout: 15000 });

    await gotoAsSignedIn(page, '/recruit/candidates');
    const candidateLink = page.locator('.table-wrap .link-btn').first();
    const candidateLabel = (await candidateLink.innerText()).trim();
    await candidateLink.click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
    await expect(rail.getByText(candidateLabel, { exact: true })).toBeVisible({ timeout: 15000 });

    const labels = (await rail.locator('.fo-recent-item .fo-recent-name').allInnerTexts()).map(
      (text) => text.trim(),
    );
    const candidateAt = labels.indexOf(candidateLabel);
    const companyAt = labels.indexOf(companyLabel);
    expect(candidateAt, `the rail must list ${candidateLabel}`).toBeGreaterThanOrEqual(0);
    expect(companyAt, `the rail must list ${companyLabel}`).toBeGreaterThanOrEqual(0);
    expect(
      candidateAt,
      'the record opened later must sit above the one opened before it. The rail is stored per staff in integration_settings, so a parallel worker signed in as the same persona writes to the same row: assert the order of this test\'s own two records, never the whole list',
    ).toBeLessThan(companyAt);
  });

  test('2.10 the rail never shows more than the records-to-keep setting', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
    const rail = page.locator('aside, .fo-sidebar').first();
    await expect(rail).toContainText(/candidate/i, { timeout: 15000 });

    await page.getByRole('button', { name: 'Configure Recently Viewed' }).click();
    const popover = page.locator('.fo-recent-settings');
    await expect(popover).toBeVisible();
    const limit = Number(await popover.getByLabel('Records to keep').inputValue());
    expect(limit, 'the popover must report the stored limit').toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    await expect
      .poll(async () => page.locator('.fo-recent-item').count(), { timeout: 15000 })
      .toBeLessThanOrEqual(limit);
  });
});

test('an empty table cell keeps its own padding, not the row padding', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates?search=zzzznomatchzzzz');
  const cell = page.locator('.table-empty');
  await expect(cell).toBeVisible({ timeout: 25000 });

  const shape = await cell.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { tag: el.tagName, padding: cs.paddingTop, align: cs.textAlign };
  });
  expect(shape.tag, 'the empty state renders as a table cell').toBe('TD');
  expect(
    shape.padding,
    'a bare .table-empty is (0,1,0) and loses to .table td (0,1,1) in the same layer, so the rule was dead and the cell used --cell-pad',
  ).toBe('24px');
  expect(shape.align).toBe('center');
});

test.describe('sortable headers', () => {
  const TABLES: [string, string][] = [
    ['candidates', '/recruit/candidates'],
    ['requisitions', '/recruit/requisitions'],
    ['accounts', '/sales/companies'],
    ['contacts', '/sales/contacts'],
    ['tickets', '/sales/tickets'],
  ];

  for (const [label, route] of TABLES) {
    test(`the sort chevron appears on hovering anywhere in a ${label} header cell`, async ({
      page,
    }) => {
      await signIn(page, PERSONA_EMAILS.admin);
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.table-wrap thead th.sortable', { timeout: 25000 });

      const th = page.locator('.table-wrap thead th.sortable').first();
      const arrow = th.locator('.sort-arrow');
      expect(
        await arrow.evaluate((el) => getComputedStyle(el).opacity),
        'the chevron is hidden until the cell is pointed at',
      ).toBe('0');

      await th.hover({ position: { x: 3, y: 3 } });
      await expect
        .poll(async () => arrow.evaluate((el) => getComputedStyle(el).opacity), {
          timeout: 10000,
          message:
            'the cell padding is part of the th but outside the button, so hovering there must still reveal the chevron',
        })
        .toBe('0.55');
    });
  }
});
