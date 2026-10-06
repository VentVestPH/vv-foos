import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const BATCH = `Iqbatch${RUN}`;
const LEAD = `Iqlead${RUN}`;

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('intake_items').insert([
    {
      channel: 'linkedin_url',
      target_type: 'candidate',
      full_name: `${LEAD} Alvarez`,
      linkedin_url: `https://www.linkedin.com/in/${LEAD.toLowerCase()}`,
      batch_label: BATCH,
      status: 'pending',
      parsed: { headline: 'Platform Engineer', company: 'Northwind', title: 'Engineer' },
    },
    {
      channel: 'sheet_import',
      target_type: 'candidate',
      full_name: `${LEAD} Bauer`,
      batch_label: BATCH,
      status: 'parsed',
      parsed: { headline: 'Data Analyst', company: 'Aurora', title: 'Analyst' },
    },
    {
      channel: 'email',
      target_type: 'contact',
      full_name: `${LEAD} Chen`,
      batch_label: BATCH,
      status: 'parsed',
      parsed: { headline: 'VP Talent', company: 'Harbour Group', title: 'VP Talent' },
    },
  ]);
  if (error) throw error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  const { error } = await admin.from('intake_items').delete().eq('batch_label', BATCH);
  if (error) throw new Error(`could not remove the intake fixture: ${error.message}`);
});

test.describe('I: the intake queue head matches the other list pages', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.fo-page-head');
  });

  test('I1: the toolbar is joined to the head rather than floating as its own box', async ({
    page,
  }) => {
    const shape = await page.evaluate(() => {
      const list = document.querySelector('.list-page') as HTMLElement;
      const toolbar = document.querySelector('.fo-page-toolbar') as HTMLElement | null;
      return {
        flush: list.getAttribute('data-flush'),
        borderTop: toolbar === null ? null : getComputedStyle(toolbar).borderTopWidth,
      };
    });
    expect(
      shape.flush,
      'flush is what joins the toolbar to the head; without it the search row reads as a separate card, which is the difference Klent saw against requisitions and candidates',
    ).toBe('true');
    expect(shape.borderTop).toBe('0px');
  });

  test('I2: the search row and Export share one sticky band joined to the head', async ({
    page,
  }) => {
    const toolbar = page.locator('.fo-page-toolbar');
    await expect(
      toolbar.getByRole('searchbox', { name: /Search Intake/i }),
      'the search row and Export share the sticky band directly under the head, which flush joins to it. That is the arrangement requisitions and candidates already had and intake did not',
    ).toBeVisible();
    await expect(toolbar.getByRole('button', { name: 'Export' })).toBeEnabled();
    expect(
      await page
        .locator('.fo-page-toolbar')
        .evaluate((el) => getComputedStyle(el).position),
      'the band the search sits in is the sticky one, the same as requisitions and candidates',
    ).toBe('sticky');
  });

  test('I3: the gear is the shared sliders control, and the toolbar carries refresh and show-all', async ({
    page,
  }) => {
    const gear = page.getByRole('button', { name: 'Column settings' });
    await expect(gear).toBeVisible();
    await expect(
      gear.locator('svg.lucide-sliders-horizontal'),
      'the same icon requisitions and candidates use, not the old cog',
    ).toHaveCount(1);

    await expect(page.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'More actions' }),
      'the overflow menu is gone; its two actions are on the toolbar itself',
    ).toHaveCount(0);

    const refresh = page
      .locator('.fo-page-head')
      .getByRole('button', { name: 'Refresh the queue' });
    await expect(refresh).toBeVisible();
    expect(
      await page.evaluate(() => {
        const head = document.querySelector('.fo-page-head') as HTMLElement;
        const controls = Array.from(head.querySelectorAll('button, a'));
        const refreshAt = controls.findIndex(
          (el) => el.getAttribute('aria-label') === 'Refresh the queue',
        );
        const pasteAt = controls.findIndex((el) =>
          (el as HTMLElement).innerText.trim().startsWith('Paste'),
        );
        return refreshAt >= 0 && pasteAt >= 0 && refreshAt < pasteAt;
      }),
      'refresh comes before Paste URLs',
    ).toBe(true);
    const chrome = await refresh.evaluate((el) => ({
      border: getComputedStyle(el).borderTopWidth,
      label: (el as HTMLElement).innerText.trim(),
      svgs: el.querySelectorAll('svg').length,
    }));
    expect(chrome.border, 'the refresh control carries no border').toBe('0px');
    expect(chrome.label, 'and no visible label, only the icon').toBe('');
    expect(chrome.svgs).toBe(1);

    await expect(
      page.locator('.fo-page-toolbar').getByRole('checkbox', { name: /Show imported \/ rejected/ }),
    ).toBeVisible();
  });

  test('I4: the queue shows the rows it has, and Target is a label not an enum', async ({
    page,
  }) => {
    await expect(page.locator('.table-wrap tbody tr').first()).toBeVisible({ timeout: 25000 });
    const rows = await page.locator('.table-wrap tbody tr').count();
    expect(rows, 'an empty queue means nothing has arrived, not that the page is broken').toBeGreaterThan(
      0,
    );

    const targets = await page.evaluate(() => {
      const head = Array.from(document.querySelectorAll('.table-wrap thead th')).findIndex(
        (th) => (th as HTMLElement).innerText.trim() === 'Target',
      );
      if (head < 0) return [];
      return Array.from(document.querySelectorAll('.table-wrap tbody tr'))
        .map((tr) => (tr.children[head] as HTMLElement | undefined)?.innerText.trim() ?? '')
        .filter(Boolean);
    });
    expect(targets.length, 'the Target column must be on screen to be checked').toBeGreaterThan(0);
    expect(
      targets.every((t) => t === 'Candidate' || t === 'Contact'),
      `Target printed the raw enum; every other column has a label map. Got ${[...new Set(targets)].join(', ')}`,
    ).toBe(true);
  });

  test('I5: Import and Export are short, and each carries its icon', async ({ page }) => {
    const importBtn = page.getByRole('link', { name: /Import/ }).getByRole('button');
    await expect(importBtn).toHaveText('Import');
    await expect(importBtn.locator('svg')).toHaveCount(1);

    const exportBtn = page.getByRole('button', { name: 'Export' });
    await expect(exportBtn).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Export CSV' }),
      'the label is Export now; the format is the icon',
    ).toHaveCount(0);
    await expect(exportBtn.locator('svg')).toHaveCount(1);
  });
});

test.describe('I: the rest of the intake queue', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
  });

  test('I6: the columns dialog arranges the table, and the rail no longer lists columns', async ({
    page,
  }) => {
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap tbody tr');

    await page.getByRole('button', { name: 'Column settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Column settings' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Batch', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    const headers = await page.locator('.table-wrap thead th').allInnerTexts();
    expect(
      headers.map((h) => h.trim()),
      'unticking Batch takes the column out of the table',
    ).not.toContain('Batch');

    await page.getByRole('button', { name: 'Advanced Search' }).click().catch(() => undefined);
    const rail = page.locator('.filter-rail, .fo-qs-advanced-section');
    if ((await rail.count()) > 0) {
      await expect(
        rail.first().getByText('Columns', { exact: true }),
        'the rail keeps Channel, Target and Status; columns moved to the dialog',
      ).toHaveCount(0);
    }
  });

  test('I7: the sortable headers include the channel icon, headline and batch', async ({ page }) => {
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap thead th');
    const sortable = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.table-wrap thead th.sortable')).map((th) =>
        (th as HTMLElement).innerText.trim(),
      ),
    );
    expect(sortable).toContain('Headline / role');
    expect(sortable).toContain('Batch');
    expect(
      sortable.some((h) => h === ''),
      'the icon column sorts too, and its header carries no text',
    ).toBe(true);
  });

  test('I8: the table loads behind a skeleton, not a Loading line', async ({ page }) => {
    await page.route('**/rest/v1/intake_items*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await gotoAsSignedIn(page, '/intake');
    const card = page.locator('.fo-skeleton-card');
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.getByRole('status')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Loading…');
    await page.unroute('**/rest/v1/intake_items*');
  });

  test('I9: the nav badge never flashes an empty pill, and pulses when it changes', async ({
    page,
  }) => {
    await gotoAsSignedIn(page, '/intake');
    const badge = page.locator('.fo-nav-badge');
    await expect(badge).toBeVisible({ timeout: 20000 });
    const shape = await badge.evaluate((el) => ({
      text: (el as HTMLElement).innerText.trim(),
      animation: getComputedStyle(el).animationName,
      duration: getComputedStyle(el).animationDuration,
      iterations: getComputedStyle(el).animationIterationCount,
      transform: getComputedStyle(el).transform,
    }));
    expect(
      shape.text,
      'an empty badge is a 16px pill with a radius of 8, which is the zero-looking blob Klent saw when a failed count reset it',
    ).not.toBe('');
    expect(Number(shape.text.replace(/\D/g, ''))).toBeGreaterThan(0);
    expect(shape.animation).toBe('fo-badge-pulse');
    expect(shape.duration).not.toBe('0s');
    expect(
      shape.iterations,
      'one beat fires on mount and is gone before anyone looks; a standing backlog has to keep asking. Asserted on the declaration, not on sampled frames: a 2 vCPU runner throttles rAF enough that a whole cycle can pass between two samples',
    ).toBe('infinite');
    expect(
      shape.transform,
      'the number itself must not grow; only the ring around it moves',
    ).toBe('none');
  });

  test('I10: the sheet importer offers a template with the columns it maps', async ({ page }) => {
    await gotoAsSignedIn(page, '/intake/sheet');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download template' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('intake-sheet-template.csv');
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const header = Buffer.concat(chunks).toString('utf8').split(/\r?\n/, 1)[0] ?? '';
    for (const field of [
      'First name',
      'Last name',
      'Email',
      'Phone',
      'Current employer',
      'Current title',
      'Country',
      'Requisition code',
      'Main status',
      'Expected salary',
      'University',
      'Experience employer',
    ]) {
      expect(header, `the template includes ${field}`).toContain(field);
    }
  });
});

test.describe('I: the intake drawer', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
  });

  test('I11: opening an item shows accordion shapes, then the whole record at once', async ({
    page,
  }) => {
    await page.route('**/rest/v1/people*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap tbody tr');
    await page.locator('.table-wrap tbody tr').first().click();

    const skeleton = page.locator('.intake-drawer .fo-skeleton-sections');
    await expect(skeleton).toBeVisible({ timeout: 15000 });
    expect(
      await skeleton.locator('.fo-skeleton-section').count(),
      'the shapes are accordions, because that is what the drawer resolves into',
    ).toBeGreaterThan(2);
    await expect(page.locator('.intake-drawer').getByRole('status')).toBeVisible();

    await expect(
      page.getByRole('button', { name: /^Parsed fields/ }),
      'the duplicate check used to pop in after the rest; now the body lands complete',
    ).toBeVisible({ timeout: 20000 });
    await expect(skeleton).toHaveCount(0);
    await page.unroute('**/rest/v1/people*');
  });

  test('I12: the duplicate section is named for what it shows, and its empty state is the shared one', async ({
    page,
  }) => {
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap tbody tr');
    await page.locator('.table-wrap tbody tr').first().click();

    const drawer = page.locator('.intake-drawer');
    await expect(drawer.getByRole('button', { name: /^Possible duplicates/ })).toBeVisible({
      timeout: 20000,
    });
    await expect(
      drawer.getByRole('button', { name: /Dedup check/ }),
      'Dedup is a database word; the panel shows possible duplicates',
    ).toHaveCount(0);

    const empty = drawer.locator('.fo-empty-state');
    if ((await empty.count()) > 0) {
      const shape = await empty.first().evaluate((el) => ({
        align: getComputedStyle(el).alignItems,
        text: getComputedStyle(el).textAlign,
        icons: el.querySelectorAll('svg').length,
      }));
      expect(shape.align, 'icon over message, centred, the same as every other empty state').toBe(
        'center',
      );
      expect(shape.text).toBe('center');
      expect(shape.icons).toBe(1);
    }
  });

  test('I13: closing the drawer moves it off to the right', async ({ page }) => {
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap tbody tr');
    await page.locator('.table-wrap tbody tr').first().click();
    const drawer = page.locator('.intake-drawer');
    await expect(drawer).toBeVisible({ timeout: 20000 });

    const closing = page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const deadline = Date.now() + 5000;
          const tick = () => {
            const el = document.querySelector('.intake-drawer') as HTMLElement | null;
            if (el === null || Date.now() > deadline) {
              resolve('');
              return;
            }
            if (el.dataset.closing === 'true') {
              resolve(getComputedStyle(el).animationName);
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.getByRole('button', { name: /close/i }).first().click();
    const seen = await closing;
    expect(
      seen,
      'the exit is its own keyframe rather than the 16px nudge every panel shares, and the keyframe is what defines the travel. Sampling the transform instead needs the animation to still be running when the sample lands, which a slow runner cannot promise',
    ).toBe('drawer-slide-out');
  });
});

test.describe('I: the intake search box', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/intake');
    await page.waitForSelector('.table-wrap tbody tr');
  });

  test('I14: it suggests intake rows, and only intake rows', async ({ page }) => {
    await page.locator('.list-page-search input').pressSequentially(LEAD, { delay: 20 });
    const pop = page.locator('.fo-hint-pop');
    await expect(pop, 'intake had no suggestions at all before this').toBeVisible({
      timeout: 15000,
    });

    const shape = await pop.evaluate((el) => ({
      hints: el.querySelectorAll('.fo-hint').length,
      hrefs: Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? ''),
      all: (el.querySelector('.fo-hint-all-btn') as HTMLElement | null)?.innerText ?? '',
    }));
    expect(shape.hints).toBeGreaterThan(0);
    expect(
      shape.hrefs.every((href) => href.startsWith('/intake')),
      `every suggestion has to be an intake row; got ${shape.hrefs.join(' ')}`,
    ).toBe(true);
    expect(shape.all.toLowerCase()).toContain('intake');
  });

  test('I15: a suggestion opens that item, and the rail fields carry their own class', async ({
    page,
  }) => {
    const rail = page.locator('.intake-advanced-search');
    const opened = await page.getByRole('button', { name: 'Advanced Search' }).count();
    if (opened > 0) await page.getByRole('button', { name: 'Advanced Search' }).click();
    if ((await rail.count()) > 0) {
      await expect(
        rail.first(),
        'intake owns this wrapper, so its spacing cannot reach the other rails',
      ).toBeVisible();
      expect(
        await rail.first().evaluate((el) => getComputedStyle(el).rowGap),
      ).not.toBe('normal');
    }

    const refresh = page.getByRole('button', { name: 'Refresh the queue' });
    const box = await refresh.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    expect(box, 'the refresh control matches the settings icon at 32 square').toEqual({
      w: 32,
      h: 32,
    });
  });
});

test.describe('I: deleting intake items', () => {
  test('I16: Delete does not exist until a row is ticked, then the bar grows open', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/intake');
    await expect(page.locator('.table-wrap tbody tr[data-row-key]').first()).toBeVisible({
      timeout: 25000,
    });

    const grow = page.locator('.fo-page-head-grow');
    await expect(grow).toHaveAttribute('data-open', 'false');
    expect(
      await grow.evaluate((el) => el.getBoundingClientRect().height),
      'a closed bulk bar occupies no height, so Delete is not on screen',
    ).toBe(0);

    const first = page.locator('.table-wrap thead th').first();
    expect(
      await first.evaluate((el) => el.className),
      'the selection column leads the row, as on accounts and requisitions',
    ).toContain('checkbox-col');

    await page.locator('.table-wrap tbody tr[data-row-key]').first().getByRole('checkbox').check();
    await expect(grow).toHaveAttribute('data-open', 'true');
    await expect(
      page.locator('.fo-list-action-bar').getByRole('button', { name: 'Delete', exact: true }),
    ).toBeVisible();
  });

  test('I17: an admin deletes the item outright, and it does not come back', async ({ page }) => {
    const admin = await clientAs('admin');
    const doomed = `${LEAD} Doomed`;
    const { error: seedErr } = await admin.from('intake_items').insert({
      channel: 'manual',
      target_type: 'candidate',
      full_name: doomed,
      batch_label: BATCH,
      status: 'parsed',
    });
    expect(seedErr, 'the fixture for this test must insert').toBeNull();

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/intake');
    const box = page.getByRole('searchbox', { name: 'Search Intake' });
    await box.fill(doomed);
    await box.press('Enter');

    const rows = page.locator('.table-wrap tbody tr[data-row-key]');
    await expect(rows).toHaveCount(1, { timeout: 25000 });
    await rows.first().getByRole('checkbox').check();
    await page
      .locator('.fo-list-action-bar')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    const dialog = page.getByRole('dialog', { name: /Delete intake item/ });
    await expect(dialog).toContainText(doomed);
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 25000 });
    await expect(page.locator('.fo-bulk-notice')).toContainText('1 item deleted.');

    const { data } = await admin
      .from('intake_items')
      .select('id')
      .eq('full_name', doomed);
    expect((data ?? []).length, 'the row is gone from the database, not just the table').toBe(0);
  });

  test('I18: a role that may not remove an item is told so, rather than the row silently staying', async ({
    page,
  }) => {
    const admin = await clientAs('admin');
    const guarded = `${LEAD} Guarded`;
    const { error: seedErr } = await admin.from('intake_items').insert({
      channel: 'manual',
      target_type: 'contact',
      full_name: guarded,
      batch_label: BATCH,
      status: 'parsed',
    });
    expect(seedErr, 'the fixture for this test must insert').toBeNull();

    await signIn(page, PERSONA_EMAILS.recruiter);
    await gotoAsSignedIn(page, '/intake');
    const box = page.getByRole('searchbox', { name: 'Search Intake' });
    await box.fill(guarded);
    await box.press('Enter');

    const rows = page.locator('.table-wrap tbody tr[data-row-key]');
    await expect(rows).toHaveCount(1, { timeout: 25000 });
    await rows.first().getByRole('checkbox').check();
    await page
      .locator('.fo-list-action-bar')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    const dialog = page.getByRole('dialog', { name: /Delete intake item/ });
    await dialog.getByRole('button', { name: 'Delete permanently' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 25000 });

    await expect(
      page.locator('.fo-bulk-notice'),
      'a recruiter may only remove candidate items, and the count has to say what was left behind',
    ).toContainText('left in place, because your role cannot remove them');

    const { data } = await admin.from('intake_items').select('id').eq('full_name', guarded);
    expect((data ?? []).length, 'the contact item survives a recruiter delete').toBe(1);
  });
});
