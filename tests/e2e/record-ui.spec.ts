import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, openFilterRail, signIn } from './helpers';
import { clientAs, deleteOwnSettings } from '../env';

const RAIL_NOTE = `QA record-ui ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const RAIL_KEY = 'ui.recentlyViewed';
const RAIL_PERSONA = 'recruiter';

const RAIL_ROOM = 50;
const TICKET_DRAFT_TITLE = `QA ticket ${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

async function resetRail(): Promise<void> {
  for (const persona of ['admin', RAIL_PERSONA] as const) {
    await deleteOwnSettings(persona, [RAIL_KEY]);
  }
}

async function giveTheRailRoom(): Promise<void> {
  const client = await clientAs(RAIL_PERSONA);
  const { data } = await client.auth.getUser();
  const staffId = data.user?.id;
  if (!staffId) throw new Error('could not resolve the recruiter persona');
  const { error } = await client
    .from('integration_settings')
    .insert({ staff_id: staffId, key: RAIL_KEY, value: { items: [], limit: RAIL_ROOM } });
  if (error) throw new Error(`could not seed the rail limit: ${error.message}`);
}

test.describe('Record and list UI criteria', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
  });

  test.afterEach(async () => {
    const admin = await clientAs('admin');
    await admin.from('activities').delete().like('subject', `${RAIL_NOTE}%`);
    const { data: drafts } = await admin.from('tickets').select('id').like('subject', `${TICKET_DRAFT_TITLE}%`);
    for (const ticket of drafts ?? []) {
      const { data: attachments } = await admin.from('attachments').select('id, storage_path').eq('parent_type', 'ticket').eq('parent_id', ticket.id);
      if (attachments?.length) {
        await admin.storage.from('attachments').remove(attachments.map((attachment) => attachment.storage_path));
        await admin.from('attachments').delete().in('id', attachments.map((attachment) => attachment.id));
      }
      await admin.from('tickets').delete().eq('id', ticket.id);
    }
    await resetRail();
  });

  test('tickets can be created with pasted images and opened from either view', async ({ page }) => {
    test.setTimeout(60000);
    await gotoAsSignedIn(page, '/sales/tickets');
    await expect(page.getByRole('heading', { name: /^Tickets/ })).toBeVisible();
    await expect(page.locator('.fo-list-toolbar .fo-pager')).toBeVisible();
    await expect(page.getByRole('button', { name: 'First page' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Last page' })).toBeVisible();
    const newTicket = page.getByRole('button', { name: 'New Ticket', exact: true });
    await expect(newTicket).toBeVisible();
    await newTicket.click();
    await expect(page.getByRole('dialog', { name: 'New ticket' })).toBeVisible();
    const dialogBox = await page.getByRole('dialog', { name: 'New ticket' }).boundingBox();
    expect(dialogBox?.width ?? 0, 'the ticket editor should use a genuinely wide dialog').toBeGreaterThan(1100);
    const fieldsBox = await page.locator('.sales-ticket-create-sidebar').boundingBox();
    const contentBox = await page.locator('.sales-ticket-editor-main').boundingBox();
    expect(fieldsBox && contentBox && fieldsBox.x > contentBox.x, 'fields belong in the right side rail').toBeTruthy();
    await page.getByRole('button', { name: 'Choose a date' }).click();
    await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
    await page.keyboard.press('Escape');
    const description = page.locator('#ticket-description');
    await page.getByLabel('Title').fill(TICKET_DRAFT_TITLE);
    await description.fill('Steps to reproduce: paste a screenshot and submit the request.');
    await page.evaluate(() => {
      const editor = document.querySelector<HTMLDivElement>('#ticket-description');
      if (!editor) throw new Error('ticket description is missing');
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS7sAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
      const clipboard = new DataTransfer();
      clipboard.items.add(new File([bytes], 'pasted-screenshot.png', { type: 'image/png' }));
      editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true }));
    });
    await expect(page.getByAltText('pasted-screenshot.png')).toBeVisible();
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (/\/storage\/v1\/object\/attachments\//.test(request.url())) uploads.push(request.url());
    });
    expect(uploads, 'pasting must not upload before the ticket is saved').toHaveLength(0);
    await page.getByLabel('Add context for your team').fill('Initial note: investigating the report.');
    await page.getByRole('dialog', { name: 'New ticket' }).locator('.fo-dialog-body').evaluate((element) => { element.scrollTop = 0; });
    await page.getByRole('button', { name: 'Create ticket' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20000 });
    expect(uploads).toHaveLength(1);
    await expect(page.locator('.table-wrap tbody')).toContainText(
      TICKET_DRAFT_TITLE,
    );
    let continueTicketRequest!: () => void;
    const ticketRequestGate = new Promise<void>((resolve) => { continueTicketRequest = resolve; });
    await page.route((url) => url.pathname === '/rest/v1/tickets' && url.searchParams.has('id'), async (route) => {
      await ticketRequestGate;
      await route.continue();
    });
    await page.getByText(TICKET_DRAFT_TITLE, { exact: true }).click();
    await expect(page).toHaveURL(/\/sales\/tickets\?id=[0-9a-f-]{36}/);
    const loadingDialog = page.getByRole('dialog', { name: 'Loading ticket' });
    await expect(loadingDialog).toBeVisible();
    await expect(loadingDialog.locator('.sales-ticket-detail-skeleton')).toBeVisible();
    const loadingBox = await loadingDialog.boundingBox();
    expect(loadingBox?.width ?? 0, 'the loading modal keeps the wide detail layout').toBeGreaterThan(1100);
    continueTicketRequest();
    await expect(page.getByRole('dialog', { name: /TKT.*QA ticket/ })).toBeVisible();
    await page.unrouteAll();
    const detailBox = await page.getByRole('dialog').boundingBox();
    const closeBox = await page.getByRole('button', { name: 'Close dialog' }).boundingBox();
    expect(detailBox && closeBox && closeBox.x + closeBox.width > detailBox.x + detailBox.width - 52).toBeTruthy();
    await expect(page.getByRole('dialog')).toContainText('Steps to reproduce: paste a screenshot');
    await expect(page.getByRole('dialog')).toContainText('Initial note: investigating the report.');
    await expect(page.locator('.sales-ticket-description-body img')).toBeVisible();
    await expect(page.getByRole('dialog')).not.toContainText('No comments yet');
    await expect(page.getByRole('dialog').getByText('Tags', { exact: true }), 'tags are no longer part of the ticket UI').toHaveCount(0);
    for (const [label, tabName] of [['All', /^All$/], ['Comments', /^Comments/], ['History', /^History$/]] as const) {
      const tab = page.getByRole('tab', { name: tabName });
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel'), `${label} shows its panel without a loading delay`).toBeVisible();
      await expect(page.getByRole('status', { name: 'Loading ticket activity' })).toHaveCount(0);
    }
    await page.getByRole('tab', { name: /^All$/ }).click();
    const sidebar = page.locator('.sales-ticket-sidebar');
    const sidebarBeforeFieldEdit = await sidebar.boundingBox();
    await sidebar.locator('[data-ticket-sidebar-field="status"]').click();
    await expect(page.getByRole('combobox', { name: 'Status' })).toBeVisible();
    const sidebarDuringFieldEdit = await sidebar.boundingBox();
    expect(sidebarBeforeFieldEdit && sidebarDuringFieldEdit && Math.abs(sidebarBeforeFieldEdit.height - sidebarDuringFieldEdit.height) < 4, 'inline field editing should not shift the sidebar layout').toBeTruthy();
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.getByRole('combobox', { name: 'Status' })).toHaveCount(0);
    await sidebar.locator('[data-ticket-sidebar-field="due"]').click();
    await expect(page.getByLabel('Due time')).toBeVisible();
    await page.getByLabel('Due time').fill('09:37');
    await expect(page.getByLabel('Due time'), 'any minute can be typed, not only quarter hours').toHaveValue('09:37');
    await page.getByRole('tab', { name: /^All$/ }).click();
    await expect(page.getByLabel('Due time')).toHaveCount(0);
    await page.locator('.sales-ticket-description').click();
    const detailImage = page.locator('.sales-ticket-description-input img').first();
    await detailImage.click();
    const resizeHandle = page.getByRole('button', { name: 'Resize image' });
    await expect(resizeHandle).toBeVisible();
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('image resize handle is missing its position');
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 96, handleBox.y + handleBox.height / 2 + 56, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => detailImage.getAttribute('width')).not.toBeNull();
    expect(Number(await detailImage.getAttribute('width'))).toBeGreaterThan(80);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.sales-ticket-description-body img').first()).toHaveAttribute('width', /\d+/);
    await page.keyboard.press('Escape');

    await page.getByRole('tab', { name: 'Kanban view' }).click();
    await expect(page.locator('.sales-ticket-board')).toContainText(TICKET_DRAFT_TITLE);
    await page.getByRole('button', { name: new RegExp(TICKET_DRAFT_TITLE) }).click();
    await expect(page.getByRole('dialog')).toContainText(TICKET_DRAFT_TITLE);
    await expect(page.getByRole('tab', { name: /^All$/ })).toBeVisible();
    await expect(page.getByText('Initial note: investigating the report.', { exact: true })).toBeVisible();
    await expect(page.locator('.sales-ticket-related-work')).toBeVisible();
    expect(await page.locator('.sales-ticket-related-work').evaluate((node) => node.compareDocumentPosition(document.querySelector('.sales-ticket-activity')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    const relationship = page.getByRole('combobox', { name: 'Link relationship' });
    await relationship.click();
    await page.getByRole('option', { name: 'Is blocked by' }).click();
    await expect(relationship).toHaveText('Is blocked by');
    const relationBox = await relationship.boundingBox();
    const relationMenuBox = await page.locator('.field-select-menu[data-fit-content="true"]').boundingBox();
    expect(relationBox?.width ?? 999, 'relationship field should fit the selected label').toBeLessThan(180);
    const linkLabelBox = await page.locator('.sales-ticket-external-link-form > .input:first-child').boundingBox();
    expect(relationBox && linkLabelBox && Math.abs(relationBox.width - linkLabelBox.width) < 2).toBeTruthy();
    await relationship.click();
    const menuBox = await page.locator('.field-select-menu[data-fit-content="true"]').boundingBox();
    expect(relationBox && menuBox && menuBox.width >= relationBox.width).toBeTruthy();
    await page.getByRole('option', { name: 'Relates to' }).click();
    const defaultRelationBox = await relationship.boundingBox();
    expect(defaultRelationBox && relationBox && defaultRelationBox.width < relationBox.width).toBeTruthy();
    const searchLinkBox = await page.getByRole('combobox', { name: 'Search tickets to link' }).boundingBox();
    expect(searchLinkBox && defaultRelationBox && searchLinkBox.width > defaultRelationBox.width * 2).toBeTruthy();
    await page.getByRole('combobox', { name: 'Search tickets to link' }).fill('hiring team asked');
    const ticketSuggestions = page.getByRole('listbox', { name: 'Suggested results' });
    await expect(ticketSuggestions).toBeVisible();
    await expect(ticketSuggestions).toContainText('Confirm interview panel availability');
    await expect(ticketSuggestions).toContainText('hiring team asked');
    await ticketSuggestions.getByRole('option', { name: /Confirm interview panel availability/ }).click();
    await page.getByRole('button', { name: 'Add ticket link' }).click();
    await expect(page.getByRole('tab', { name: /^All$/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/Confirm interview panel availability/).last()).toBeVisible();
    await page.getByLabel('Link label').fill('Project docs');
    await page.getByLabel('Link URL').fill('example.com/tickets/guide');
    await page.getByRole('button', { name: 'Add link', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Project docs' })).toHaveAttribute('href', 'https://example.com/tickets/guide');
    const commentEditor = page.locator('#ticket-comment');
    await commentEditor.fill('Screenshot attached from the ticket activity editor.');
    await commentEditor.evaluate((editor) => {
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS7sAAAAASUVORK5CYII='), (character) => character.charCodeAt(0));
      const clipboard = new DataTransfer();
      clipboard.items.add(new File([bytes], 'comment-screenshot.png', { type: 'image/png' }));
      editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true }));
    });
    await expect(commentEditor.locator('img[alt="comment-screenshot.png"]')).toBeVisible();
    const commentUploads: string[] = [];
    page.on('request', (request) => {
      if (/\/storage\/v1\/object\/attachments\//.test(request.url())) commentUploads.push(request.url());
    });
    expect(commentUploads, 'comment files stay local before posting').toHaveLength(0);
    await page.getByRole('button', { name: 'Post comment' }).click();
    await expect(page.getByText('Screenshot attached from the ticket activity editor.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /^All$/ }).click();
    await expect(page.locator('.sales-ticket-all-comment img')).toBeVisible();
    expect(commentUploads).toHaveLength(1);
    const displayedTitleSize = await page.locator('.sales-ticket-workitem-title').evaluate((element) => getComputedStyle(element).fontSize);
    await page.locator('.sales-ticket-workitem-title').click();
    await expect(page.getByText('Description:', { exact: true })).toBeVisible();
    const editTitle = page.getByLabel('Title');
    await expect(editTitle).toBeVisible();
    await expect(page.getByRole('toolbar', { name: 'Description formatting' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Description' })).toHaveCount(0);
    const inputTitleSize = await editTitle.evaluate((element) => getComputedStyle(element).fontSize);
    expect(inputTitleSize).toBe(displayedTitleSize);
    await editTitle.fill(`${TICKET_DRAFT_TITLE} canceled`);
    await page.getByRole('tab', { name: 'History' }).click();
    await expect(page.locator('.sales-ticket-workitem-title')).toHaveText(TICKET_DRAFT_TITLE);
    await page.locator('.sales-ticket-description').click();
    await expect(page.getByRole('textbox', { name: 'Description' })).toBeVisible();
    await expect(page.getByLabel('Title')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('.sales-ticket-workitem-title').click();
    await page.getByLabel('Title').fill(`${TICKET_DRAFT_TITLE} discarded`);
    await page.keyboard.press('Escape');
    await expect(page.locator('.sales-ticket-workitem-title')).toHaveText(TICKET_DRAFT_TITLE);
    await page.locator('.sales-ticket-workitem-title').click();
    await page.getByLabel('Title').fill(`${TICKET_DRAFT_TITLE} updated`);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.sales-ticket-workitem-title')).toHaveText(`${TICKET_DRAFT_TITLE} updated`);
    await page.locator('.sales-ticket-workitem-title').click();
    await page.getByLabel('Title').fill(TICKET_DRAFT_TITLE);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL('/sales/tickets');
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('foos.tickets.view'))).toBe('kanban');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Kanban view' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.sales-ticket-board')).toContainText(TICKET_DRAFT_TITLE);
    await page.getByRole('button', { name: new RegExp(TICKET_DRAFT_TITLE) }).click();
    await expect(page).toHaveURL(/\/sales\/tickets\?id=[0-9a-f-]{36}/);
    await page.reload();
    await expect(page.getByRole('dialog')).toContainText(TICKET_DRAFT_TITLE);
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
    for (const quickAdd of ['Note', 'Call', 'Task', 'Reminder']) {
      await expect(page.getByRole('button', { name: quickAdd, exact: true })).toBeVisible();
    }
  });

  test('2.9 and 2.11 the candidate list offers a saved view and a CSV export', async ({ page }) => {
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.getByRole('button', { name: 'Save view', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    await openFilterRail(page);
  });

  test('2.6 and 3.3 the deals board offers both kanban and table views over one dataset', async ({ page }) => {
    await gotoAsSignedIn(page, '/sales/deals');

    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(page.locator('.table-wrap table')).toBeVisible({ timeout: 20000 });
    const rows = page.locator('.table-wrap tbody tr:not(:has(td[colspan]))');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    const tableRows = await rows.count();
    expect(tableRows).toBeGreaterThan(0);

    await page.getByRole('tab', { name: 'Kanban' }).click();
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
    await giveTheRailRoom();
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
    expect(
      candidateAt,
      `the rail must list ${candidateLabel}. The rail is one integration_settings row per staff, so a parallel worker signed in as this persona writes the same row: the limit is raised to ${RAIL_ROOM} in beforeEach so a neighbour's opens cannot evict either of these two`,
    ).toBeGreaterThanOrEqual(0);
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

test.describe('sorting from anywhere in the header cell', () => {
  const TABLES: [string, string][] = [
    ['candidates', '/recruit/candidates'],
    ['requisitions', '/recruit/requisitions'],
    ['intake', '/intake'],
  ];

  for (const [label, route] of TABLES) {
    test(`a click in the ${label} header padding sorts, not just one on the text`, async ({
      page,
    }) => {
      await signIn(page, PERSONA_EMAILS.admin);
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.table-wrap thead th.sortable');

      const th = page.locator('.table-wrap thead th.sortable').first();
      const fills = await th.evaluate((el) => {
        const cell = el.getBoundingClientRect();
        const btn = (el.querySelector('.th-sort-btn') as HTMLElement).getBoundingClientRect();
        return {
          dx: Math.round(cell.width - btn.width),
          dy: Math.round(cell.height - btn.height),
        };
      });
      expect(
        Math.max(fills.dx, fills.dy),
        'the button has to own the whole cell; while the padding belonged to the th it looked clickable and was not',
      ).toBeLessThanOrEqual(1);

      const before = await th.getAttribute('aria-sort');
      await th.click({ position: { x: 3, y: 3 } });
      await expect
        .poll(async () => th.getAttribute('aria-sort'), {
          timeout: 15000,
          message: 'clicking the top-left corner of the cell must sort',
        })
        .not.toBe(before);
    });
  }
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
