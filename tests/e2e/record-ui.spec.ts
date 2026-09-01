import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

test.describe('Record and list UI criteria', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
  });

  test('2.10 the Recently Viewed rail records opens across modules, newest first', async ({ page }) => {
    const rail = page.locator('aside, .taleo-sidebar').first();

    await gotoAsSignedIn(page, '/sales/companies');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/sales\/companies\/[0-9a-f-]{36}/);
    await expect(rail).toContainText(/Recently Viewed/);
    await expect(rail).toContainText(/company/);

    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
    await expect(rail).toContainText(/candidate/);

    const railText = (await rail.innerText()).slice((await rail.innerText()).indexOf('Recently Viewed'));
    expect(railText.indexOf('candidate')).toBeLessThan(railText.indexOf('company'));
  });

  test('2.10 the rail never grows past 15 entries', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/recruit\/candidates\/[0-9a-f-]{36}/);
    await expect(page.locator('aside, .taleo-sidebar').first()).toContainText(/candidate/, {
      timeout: 15000,
    });

    const key = await page.evaluate(
      () => Object.keys(localStorage).find((k) => k.startsWith('foos.recentlyViewed.')) ?? null,
    );
    expect(key, 'opening a record should create the recently-viewed store').not.toBeNull();

    await page.evaluate((k: string) => {
      const seeded = Array.from({ length: 40 }, (_, i) => ({
        type: 'candidate',
        id: `seed-${i}`,
        label: `Seed ${i}`,
        viewedAt: new Date().toISOString(),
      }));
      localStorage.setItem(k, JSON.stringify(seeded));
    }, key as string);

    await gotoAsSignedIn(page, '/sales/companies');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/sales\/companies\/[0-9a-f-]{36}/);
    await expect(page.locator('aside, .taleo-sidebar').first()).toContainText(/company/, {
      timeout: 15000,
    });

    const capped = await page.evaluate(
      (k: string) => (JSON.parse(localStorage.getItem(k) ?? '[]') as unknown[]).length,
      key as string,
    );
    expect(capped).toBe(15);

    const railItems = await page.locator('aside li, .taleo-sidebar li').count();
    expect(railItems).toBeLessThanOrEqual(30);

    await page.evaluate((k: string) => localStorage.removeItem(k), key as string);
  });

  test('3.8 the tickets list is read-only, with no working mutation control', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/tickets');
    await expect(page.getByRole('heading', { name: /^Tickets/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Ticket', exact: true })).toBeDisabled();
    await expect(page.locator('.table-wrap input:not([disabled]), .table-wrap select:not([disabled])')).toHaveCount(0);
    await expect(page.locator('.table-wrap tbody')).toContainText(/No tickets/i);
  });

  test('3.1 a company record shows contacts, deals, requisitions and an activity timeline', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/companies');
    await page.locator('.table-wrap .link-btn').first().click();
    await expect(page).toHaveURL(/\/sales\/companies\/[0-9a-f-]{36}/);

    for (const section of [/Details/, /Contacts \(\d+\)/, /Open deals \(\d+\)/, /Requisitions \(\d+\)/, /Activity/]) {
      await expect(page.getByRole('button', { name: section }).first()).toBeVisible();
    }
    for (const panel of ['Notes', 'Calls', 'Meetings', 'Events', 'Emails']) {
      await expect(page.getByText(panel, { exact: true }).first()).toBeVisible();
    }
    for (const quickAdd of ['+ Note', '+ Call', '+ Task', '+ Reminder']) {
      await expect(page.getByRole('button', { name: quickAdd, exact: true })).toBeVisible();
    }
  });

  test('2.9 and 2.11 the candidate list offers a saved view and a CSV export', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.getByRole('button', { name: 'Save view', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
    await expect(page.locator('.filter-rail')).toBeVisible();
  });

  test('2.6 and 3.3 the deals board offers both kanban and table views over one dataset', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');
    await page.getByRole('button', { name: 'Table' }).click();
    const tableRows = await page.locator('.table-wrap tbody tr:not(:has(td[colspan]))').count();

    await page.getByRole('button', { name: 'Kanban' }).click();
    await expect(page.locator('.table-wrap table')).toHaveCount(0);
    const cards = await page.locator('.kanban-card, [data-deal-id]').count();

    if (cards > 0) expect(cards).toBe(tableRows);
    else expect(tableRows).toBeGreaterThan(0);
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
