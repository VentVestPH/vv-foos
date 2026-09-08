import { expect, test, type Page } from '@playwright/test';
import { PERSONA_EMAILS, expandSection, gotoAsSignedIn, openFilterRail, signIn } from './helpers';

const RAIL_ROUTES = [
  '/recruit/candidates',
  '/recruit/requisitions',
  '/sales/contacts',
  '/sales/deals',
  '/sales/companies',
  '/intake',
];

function railHeader(page: Page) {
  return page.locator('.filter-rail .record-section-header');
}

test('no advanced-search rail is a native details element', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  let headers = 0;
  for (const route of RAIL_ROUTES) {
    await gotoAsSignedIn(page, route);
    await openFilterRail(page);
    const header = railHeader(page);
    await expect(header).toHaveCount(1);
    await expect(header).toHaveText('Advanced Search');
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    headers += 1;
    expect(await page.locator('details.fo-advanced-search').count()).toBe(0);
    expect(await page.locator('summary').count()).toBe(0);
  }
  expect(headers).toBe(RAIL_ROUTES.length);
});

test('the advanced-search rail interpolates its height in both directions', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals');
  await openFilterRail(page);
  const header = railHeader(page);
  const collapse = page.locator('.filter-rail .record-section-collapse');

  await expect(collapse).toHaveCSS('transition-property', /grid-template-rows/);
  const openRows = await collapse.evaluate((el) => getComputedStyle(el).gridTemplateRows);

  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await page.waitForTimeout(400);
  const shutRows = await collapse.evaluate((el) => getComputedStyle(el).gridTemplateRows);

  console.log(`PROBE rail open=${openRows} shut=${shutRows}`);
  expect(openRows).not.toBe(shutRows);
  expect(shutRows).toBe('0px');
});

test('a required field that is empty produces a focused error summary that links to it', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/companies/new');

  const summary = page.locator('.error-summary');
  await expect(summary).toHaveCount(0);

  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('role', 'alert');
  await expect(summary).toContainText('Company name is required.');
  await expect(summary).toBeFocused();

  const field = page.locator('#company-name');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#company-name-error')).toHaveText('Company name is required.');

  await summary.getByRole('link', { name: 'Company name is required.' }).click();
  await expect(field).toBeFocused();

  await field.fill('Zaffordance probe');
  await expect(summary).toBeVisible();
});

test('number inputs draw no browser spinner', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/sales/deals/new');
  await expect(page.locator('#deal-name')).toBeVisible({ timeout: 25000 });
  const measured = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('input[type="number"]'))) {
      out.push(getComputedStyle(el).appearance);
    }
    return out;
  });
  console.log(`PROBE numberInputs=${measured.length} appearance=${[...new Set(measured)].join(',')}`);
  expect(measured.length).toBeGreaterThan(0);
  expect([...new Set(measured)]).toEqual(['textfield']);
});

test('the file input is a styled label over a focusable native input', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/candidates');
  const firstName = page.locator('.table-wrap tbody tr:not(:has(td[colspan])) .link-btn').first();
  await expect(firstName).toBeVisible({ timeout: 25000 });
  await firstName.click();

  await expandSection(page, 'Attachments');
  const upload = page.locator('.file-field-btn');
  const input = page.locator('.file-field-input').first();
  await expect(input).toHaveCount(1);

  const measured = await input.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      name: el.getAttribute('aria-label'),
      type: (el as HTMLInputElement).type,
      display: cs.display,
      clipped: cs.clipPath,
      width: Math.round(box.width),
    };
  });
  console.log(
    `PROBE fileField name="${measured.name ?? ''}" type=${measured.type} display=${measured.display} clip=${measured.clipped}`,
  );

  expect(measured.type).toBe('file');
  expect(measured.display).not.toBe('none');
  expect(measured.name === null ? '' : measured.name).toMatch(/Upload/);
  expect(await upload.count()).toBe(1);
  expect(await upload.textContent()).toMatch(/Choose a (resume|file)/);
  expect(await page.locator('.file-field-name').first().textContent()).toContain('No file chosen');

  await input.focus();
  await expect(input).toBeFocused();
});

test('a button that is working says so with aria-busy and a spinner', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`CONSOLE ${m.text().slice(0, 160)}`);
  });
  page.on('pageerror', (e) => console.log(`PAGEERROR ${e.message.slice(0, 160)}`));
  await page.route('**/functions/v1/intake-sheet-fetch', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await route.fulfill({
      status: 500,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ error: 'probe' }),
    });
  });
  await gotoAsSignedIn(page, '/intake/sheet');

  const url = page.getByLabel('Sheet URL');
  await url.fill('https://docs.google.com/spreadsheets/d/probe');
  const fetchBtn = page.getByRole('button', { name: 'Fetch' });
  await fetchBtn.click();

  await expect(fetchBtn).toHaveAttribute('aria-busy', 'true');
  await expect(fetchBtn).toBeDisabled();
  const ring = fetchBtn.locator('.spinner-ring');
  await expect(ring).toHaveCount(1);
  const anim = await ring.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, count: cs.animationIterationCount, duration: cs.animationDuration };
  });
  console.log(`PROBE spinner animation=${anim.name} iterations=${anim.count} duration=${anim.duration}`);
  expect(anim.name).toBe('spinner-rotate');
  expect(anim.count).toBe('infinite');
  await expect(fetchBtn).not.toHaveAttribute('aria-busy', 'true', { timeout: 15000 });
});

test('the requisition form answers a failed submit with one summary, not two copies', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, '/recruit/requisitions/new');
  await expect(page.locator('#req-title')).toBeVisible({ timeout: 25000 });

  await page.getByRole('button', { name: 'Save', exact: true }).first().click();

  const summary = page.locator('.error-summary');
  await expect(summary).toHaveCount(1);
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Title is required.');
  await expect(summary).toContainText('At least one owner is required.');

  const anywhere = page.getByText('At least one owner is required.');
  console.log(`PROBE ownerMessageCopies=${String(await anywhere.count())}`);
  expect(await anywhere.count()).toBe(1);

  await expect(page.locator('#req-title')).toHaveAttribute('aria-invalid', 'true');
  await summary.getByRole('link', { name: 'Title is required.' }).click();
  await expect(page.locator('#req-title')).toBeFocused();
});

test('W25: no button or single-line field renders taller than 32px', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);

  const routes = ['/recruit/requisitions/new', '/recruit/candidates', '/sales/deals'];
  const tall: string[] = [];
  let measured = 0;
  const seen = new Map<number, number>();

  for (const route of routes) {
    await gotoAsSignedIn(page, route);
    await expect(page.locator('.btn').first()).toBeVisible({ timeout: 25000 });
    const found = await page.evaluate(() => {
      const sel =
        'button.btn, .field input:not([type="checkbox"]):not([type="radio"]), .input, .field-select, .date-field-btn';
      return Array.from(document.querySelectorAll(sel))
        .map((el) => {
          const r = (el as HTMLElement).getBoundingClientRect();
          return { h: Math.round(r.height), cls: (el as HTMLElement).className.toString().slice(0, 50) };
        })
        .filter((x) => x.h > 0);
    });
    for (const item of found) {
      measured += 1;
      seen.set(item.h, (seen.get(item.h) ?? 0) + 1);
      if (item.h > 32) tall.push(`${route} ${item.h}px ${item.cls}`);
    }
  }

  const spread = [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => `${h}x${n}`);
  console.log(`PROBE controlsMeasured=${measured} heights=${spread.join(',')}`);
  expect(measured).toBeGreaterThan(0);
  expect(tall, 'every button and single-line field is capped at 32px').toEqual([]);

  await gotoAsSignedIn(page, '/recruit/requisitions/new');
  await expect(page.locator('.record-section-header').first()).toBeVisible({ timeout: 25000 });
  const headers = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.record-section-header')).map((el) =>
      Math.round((el as HTMLElement).getBoundingClientRect().height),
    ),
  );
  expect(headers.length, 'a record page must carry section headers to measure').toBeGreaterThan(0);
  expect(
    [...new Set(headers)],
    'an accordion title is a section header, not a control: a uniform 41px bar matching the sidebar',
  ).toEqual([41]);
});
