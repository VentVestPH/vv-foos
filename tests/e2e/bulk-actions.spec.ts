import { expect, test, type Page } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, chooseOption, gotoAsSignedIn, signIn, waitForAnimations } from './helpers';

interface Snapshot {
  person_id: string;
  status_id: string | null;
  do_not_contact: boolean;
}

const touched = new Map<string, Snapshot>();

async function remember(ids: string[]) {
  const admin = await clientAs('admin');
  const missing = ids.filter((id) => !touched.has(id));
  if (!missing.length) return;
  const { data, error } = await admin
    .from('candidate_profiles')
    .select('person_id, status_id, do_not_contact')
    .in('person_id', missing);
  expect(error, error?.message).toBeNull();
  for (const row of data ?? []) touched.set(row.person_id, row);
}

test.afterAll(async () => {
  if (!touched.size) return;
  const admin = await clientAs('admin');
  for (const snap of touched.values()) {
    const { error } = await admin
      .from('candidate_profiles')
      .update({ status_id: snap.status_id, do_not_contact: snap.do_not_contact })
      .eq('person_id', snap.person_id);
    if (error) throw new Error(`could not restore ${snap.person_id}: ${error.message}`);
  }
  touched.clear();
});

async function selectTwo(page: Page): Promise<string[]> {
  const rows = page.locator('.table-wrap tbody tr[data-row-key]');
  await expect(rows.first()).toBeVisible({ timeout: 25000 });
  await expect
    .poll(
      async () =>
        (
          await rows.evaluateAll((els) =>
            els.map((el) => el.getAttribute('data-row-key') ?? '').filter(Boolean),
          )
        ).length,
      { timeout: 25000 },
    )
    .toBeGreaterThanOrEqual(2);

  const allKeys = await rows.evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-row-key') ?? '').filter(Boolean),
  );
  const keys = allKeys.slice(0, 2);
  expect(keys).toHaveLength(2);
  await remember(keys);
  for (const key of keys) {
    await page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`).check();
  }
  return keys;
}

async function reselect(page: Page, keys: string[]) {
  for (const key of keys) {
    const box = page.locator(`tr[data-row-key="${key}"] input[type="checkbox"]`);
    await expect(box).toBeVisible({ timeout: 20000 });
    await box.check();
  }
}

async function openBulkOverflow(
  page: import('@playwright/test').Page,
  item: string,
): Promise<void> {
  await expect(page.locator('.fo-page-head-grow')).toHaveAttribute('data-open', 'true');
  await waitForAnimations(page);
  await page.locator('.fo-list-action-bar').getByRole('button', { name: 'More actions' }).click();
  const entry = page.getByRole('menuitem', { name: item });
  await expect(entry).toBeVisible();
  await waitForAnimations(page);
  await entry.click();
}

test.describe('Q1: bulk actions on the candidate list', () => {
  test('the buttons are out of reach until something is selected', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

    const status = page.getByRole('button', { name: 'Change status' });
    const grow = page.locator('.fo-page-toolbar .fo-page-head-grow');
    await expect(grow).toHaveAttribute('data-open', 'false');
    for (const name of ['Change status', 'Send Email', 'More actions']) {
      await expect(
        page.getByRole('button', { name }),
        `${name} must not be reachable with nothing selected`,
      ).toHaveCount(0);
    }

    await selectTwo(page);
    await expect(grow).toHaveAttribute('data-open', 'true');
    await expect(status).toBeEnabled();
  });

  test('changing the main status of two candidates writes both and logs both', async ({ page }) => {
    const admin = await clientAs('admin');
    const { data: statuses } = await admin
      .from('candidate_statuses')
      .select('id, label')
      .order('sort_order');

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const keys = await selectTwo(page);

    const current = new Set(keys.map((key) => touched.get(key)?.status_id));
    const target = statuses?.find((s) => !current.has(s.id));
    expect(target, 'need a status neither candidate already has').toBeTruthy();
    const since = new Date(Date.now() - 60000).toISOString();

    await page.getByRole('button', { name: 'Change status' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Change status');
    await chooseOption(page, dialog.getByRole('combobox', { name: 'Main status' }), target!.label);
    await dialog.getByRole('button', { name: 'Update', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const { data: rows } = await admin
      .from('candidate_profiles')
      .select('person_id, status_id')
      .in('person_id', keys);
    expect(rows?.length).toBe(2);
    expect(rows?.every((r) => r.status_id === target!.id)).toBe(true);

    const { data: activities, error } = await admin
      .from('activities')
      .select('person_id, kind, body')
      .eq('kind', 'status_change')
      .eq('body', target!.label)
      .in('person_id', keys)
      .gte('occurred_at', since);
    expect(error, error?.message).toBeNull();
    expect(
      new Set((activities ?? []).map((a) => a.person_id)).size,
      'the trigger logs one status_change per candidate, not one per statement',
    ).toBe(2);
  });

  test('marking do not contact takes those candidates out of a bulk email', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const keys = await selectTwo(page);

    await openBulkOverflow(page, 'Mark as…');
    let dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Mark candidates');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const admin = await clientAs('admin');
    const { data: flagged } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .in('person_id', keys);
    expect(flagged?.every((r) => r.do_not_contact)).toBe(true);

    await reselect(page, keys);
    await page.getByRole('button', { name: 'Send Email' }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Not emailed');
    await expect(dialog).toContainText('marked do not contact');
    await expect(dialog.getByRole('button', { name: 'Send', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await reselect(page, keys);
    await openBulkOverflow(page, 'Mark as…');
    dialog = page.getByRole('dialog');
    await dialog.getByRole('radio', { name: 'Contactable again' }).check();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 20000 });

    const { data: cleared } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .in('person_id', keys);
    expect(cleared?.every((r) => !r.do_not_contact)).toBe(true);
  });

  test('a sourcer cannot change candidates in bulk', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    await page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]').check();

    const status = page.getByRole('button', { name: 'Change status' });
    await expect(status).toBeDisabled();
    await expect(status).toHaveAttribute(
      'title',
      'Only an admin or a recruiter can change candidates in bulk',
    );
  });
});

test('the bulk bar fades in, and its menu escapes the grow once it has settled', async ({
  page,
}) => {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });

  const inner = page.locator('.fo-page-head-grow-inner');
  const closed = await inner.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      opacity: style.opacity,
      overflow: style.overflow,
      property: style.transitionProperty,
      duration: style.transitionDuration,
      delay: style.transitionDelay,
    };
  });
  expect(closed.opacity, 'a bar nobody asked for is not merely short, it is invisible').toBe('0');
  expect(closed.overflow, 'the grow needs the clip to read as a reveal').toBe('hidden');
  expect(closed.property, 'it fades as well as unfolding').toContain('opacity');
  expect(closed.duration.split(', ')[0], 'and the fade has a real duration').not.toBe('0s');

  await page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]').check();
  await expect(page.locator('.fo-page-head-grow')).toHaveAttribute('data-open', 'true');

  const open = await inner.evaluate((el) => {
    const style = getComputedStyle(el);
    return { delay: style.transitionDelay.split(', ')[0], duration: style.transitionDuration };
  });
  expect(
    open.delay,
    'the fade is staggered behind the height reveal, which is the whole point: run them together and the box is still a few pixels tall for the first third of the fade, so it reads as appearing whole. Asserted on the declaration rather than on sampled frames, because a 140ms fade completes between two rAFs on a 2 vCPU runner and this test failed in CI four times over that',
  ).not.toBe('0s');

  await expect
    .poll(async () => inner.evaluate((el) => getComputedStyle(el).opacity), { timeout: 10000 })
    .toBe('1');
  await expect
    .poll(async () => inner.evaluate((el) => getComputedStyle(el).overflow), {
      timeout: 10000,
      message:
        'the ellipsis menu is a child of this box, so the clip has to lift once the grow finishes or the dropdown is cut off and the pager takes its clicks',
    })
    .toBe('visible');

  await page.locator('.fo-list-action-bar').getByRole('button', { name: 'More actions' }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  for (const item of ['Mark as…', 'View Resume', 'Print profile', 'Submit']) {
    await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
  }
  const bar = await page
    .locator('.fo-list-action-bar')
    .evaluate((el) => Array.from(el.querySelectorAll(':scope > button')).map((b) => b.textContent));
  expect(bar.length, `the bar itself stays small; got ${bar.join(', ')}`).toBeLessThanOrEqual(3);
});

test('the bulk menu prints the selection and submits it, rather than explaining itself', async ({
  page,
}) => {
  const admin = await clientAs('admin');
  const req = await admin
    .from('requisitions')
    .insert({ title: `Bareq${Date.now()}`, status: 'open', num_openings: 1, is_test: true })
    .select('id, title')
    .single();
  if (req.error) throw req.error;

  try {
    await page.addInitScript(() => {
      const probe = window as unknown as {
        __printed: number;
        __sheet: { cards: number; text: number; scope: string; hasList: boolean } | null;
      };
      probe.__printed = 0;
      probe.__sheet = null;
      window.print = () => {
        const sheet = document.querySelector('body > .cand-print-sheet');
        const list = document.querySelector('.list-page-body');
        probe.__sheet =
          sheet === null
            ? null
            : {
                cards: sheet.querySelectorAll('.cand-print-card').length,
                text: (sheet.textContent ?? '').trim().length,
                scope: document.body.dataset.printScope ?? '',
                hasList: list !== null,
              };
        probe.__printed += 1;
        window.dispatchEvent(new Event('afterprint'));
      };
    });
    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/recruit/candidates');
    const keys = await selectTwo(page);

    await openBulkOverflow(page, 'Print profile');
    await expect(
      page.locator('.fo-placeholder-modal'),
      'Print profile is a feature now, not an apology',
    ).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed), {
        timeout: 10000,
      })
      .toBe(1);

    const printed = await page.evaluate(
      () =>
        (
          window as unknown as {
            __sheet: { cards: number; text: number; scope: string; hasList: boolean } | null;
          }
        ).__sheet,
    );
    expect(
      printed,
      'the sheet must exist on the body at the moment print is called. Reading the DOM afterwards races the afterprint that unmounts it, which is why this passed here and failed in CI',
    ).not.toBeNull();
    expect(printed!.cards, 'one card per selected candidate').toBe(2);
    expect(
      printed!.text,
      'a page with no text on it is the blank page this replaced',
    ).toBeGreaterThan(40);
    expect(
      printed!.scope,
      'the scope attribute is what the print layer keys off to take the list out of the way; the rules themselves only apply in print media, so this is the part a screen run can check',
    ).toBe('selection');
    expect(printed!.hasList).toBe(true);

    await reselect(page, keys);
    await openBulkOverflow(page, 'Submit');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Submit to a requisition');
    await expect(dialog).toContainText('2 selected');
    await dialog.getByLabel('Search requisitions').fill(req.data.title);
    const row = dialog.locator('.panel-item', { hasText: req.data.title });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 20000 });

    const { data: apps } = await admin
      .from('applications')
      .select('person_id, stage')
      .eq('requisition_id', req.data.id);
    expect(apps?.length, 'one application per selected candidate').toBe(keys.length);
    expect(apps?.every((a) => a.stage === 'submitted')).toBe(true);
  } finally {
    await admin.from('applications').delete().eq('requisition_id', req.data.id);
    await admin.from('requisitions').delete().eq('id', req.data.id);
  }
});

test('the bulk menu opens the selected resumes and names who has none', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await selectTwo(page);

  const opened: string[] = [];
  page.on('popup', (popup) => {
    opened.push(popup.url());
    void popup.close();
  });

  await openBulkOverflow(page, 'View Resume');
  await expect(
    page.locator('.fo-placeholder-modal'),
    'View Resume for a selection is a feature now',
  ).toHaveCount(0);
  await expect(page.locator('.fo-bulk-outcome')).toBeVisible({ timeout: 20000 });
  const said = (await page.locator('.fo-bulk-outcome').innerText()).trim();
  expect(
    said,
    'it reports what it opened and how many of the selection had nothing to open',
  ).toMatch(/resume|none of the selected/i);
});

test('a candidate selected on another page is named, not shown as a uuid', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.recruiter);
  await gotoAsSignedIn(page, '/recruit/candidates');
  await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
  await page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]').check();

  const next = page.getByRole('button', { name: 'Next page' }).first();
  if ((await next.count()) > 0 && (await next.isEnabled())) {
    await next.click();
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    await page.locator('.table-wrap tbody tr').first().locator('input[type="checkbox"]').check();
  }

  await openBulkOverflow(page, 'Mark as…');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Mark candidates');
  await expect
    .poll(async () => (await dialog.innerText()).match(/[0-9a-f-]{36}/) === null, {
      timeout: 15000,
      message:
        'the Selected list read person_id for anyone not on the loaded page, because the names only ever came from the rows in memory',
    })
    .toBe(true);
});
