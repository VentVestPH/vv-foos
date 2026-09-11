import { expect, test } from '@playwright/test';
import { clientAs } from '../env';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const FIRST = `Crfirst${RUN}`;
const LAST = `Crlast${RUN}`;

let person = '';

test.beforeAll(async () => {
  const admin = await clientAs('admin');
  const { data, error } = await admin
    .from('people')
    .insert({
      first_name: FIRST,
      last_name: LAST,
      city: 'Manila',
      state: 'NCR',
      country: 'Philippines',
      emails: [{ type: 'personal', address: `${FIRST.toLowerCase()}@example.test` }],
      linkedin_public_url: 'https://www.linkedin.com/in/example-candidate',
      is_test: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  person = data.id;
  const profile = await admin
    .from('candidate_profiles')
    .insert({ person_id: person, do_not_contact: false, current_title: 'Test title' });
  if (profile.error) throw profile.error;
});

test.afterAll(async () => {
  const admin = await clientAs('admin');
  await admin.from('candidate_profiles').delete().eq('person_id', person);
  const { error } = await admin.from('people').delete().eq('id', person);
  if (error) throw new Error(`could not remove the candidate-record fixture: ${error.message}`);
});

test.describe('C: the candidate record header', () => {
  test('C1: the action bar is short, and the rest lives behind the ellipsis', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    const bar = page.locator('.record-action-bar');
    const labels = await bar.evaluate((el) =>
      Array.from(el.querySelectorAll('button')).map((b) =>
        (b.innerText || b.getAttribute('aria-label') || '').trim(),
      ),
    );
    expect(
      labels.length,
      `the bar was eight controls wide; it must stay small. Got ${labels.join(', ')}`,
    ).toBeLessThanOrEqual(5);
    expect(labels[0], 'Save profile leads the bar').toBe('Save profile');
    expect(labels[labels.length - 1], 'and the ellipsis is always the last control').toBe(
      'More actions',
    );
    expect(labels, 'the overflow trigger is an icon named for what it does').toContain(
      'More actions',
    );
    expect(
      await bar.locator('.fo-action-menu-trigger').count(),
      'and it is the icon-only trigger the requisition record uses, not a More button',
    ).toBe(1);
    for (const gone of ['Print Resume', 'Submit', 'Schedule meeting']) {
      expect(labels, `${gone} belongs in the overflow now`).not.toContain(gone);
    }

    await bar.locator('.fo-action-menu-trigger').click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    for (const item of ['Schedule meeting', 'Print profile', 'Submit', 'Merge duplicate…']) {
      await expect(menu.getByRole('menuitem', { name: item })).toBeVisible();
    }
  });

  test('C2: the flag is a real icon that fills when set, and it writes', async ({ page }) => {
    const admin = await clientAs('admin');
    await admin.from('candidate_profiles').update({ do_not_contact: false }).eq('person_id', person);

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    const flag = page.locator('.cand-flag-toggle');
    await expect(flag).toBeVisible({ timeout: 25000 });

    const read = () =>
      page.evaluate(() => {
        const button = document.querySelector('.cand-flag-toggle') as HTMLElement;
        const svg = button.querySelector('svg') as SVGElement;
        return {
          on: button.getAttribute('data-on'),
          pressed: button.getAttribute('aria-pressed'),
          fill: getComputedStyle(svg).fill,
          banner: document.querySelectorAll('.dnc-banner').length,
        };
      });

    const hollow = await read();
    expect(hollow.on).toBe('false');
    expect(hollow.fill, 'unset, the flag is an outline').toBe('none');
    expect(hollow.banner).toBe(0);

    await flag.click();
    await expect(flag).toHaveAttribute('data-on', 'true', { timeout: 15000 });
    const filled = await read();
    expect(filled.pressed, 'it reports its state to a screen reader too').toBe('true');
    expect(filled.fill, 'set, the flag fills').not.toBe('none');
    expect(filled.banner, 'and the do-not-contact banner appears with it').toBe(1);

    const { data: written } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .eq('person_id', person)
      .single();
    expect(written?.do_not_contact, 'the flag is do_not_contact, not a decoration').toBe(true);

    await flag.click();
    await expect(flag).toHaveAttribute('data-on', 'false', { timeout: 15000 });
    const { data: cleared } = await admin
      .from('candidate_profiles')
      .select('do_not_contact')
      .eq('person_id', person)
      .single();
    expect(cleared?.do_not_contact, 'and clicking again clears it').toBe(false);
  });

  test('C3: a sourcer sees the flag but cannot set it', async ({ page }) => {
    const admin = await clientAs('admin');
    const sourcer = await clientAs('sourcer');
    const { data: me } = await sourcer.auth.getUser();
    const sourcerId = me.user?.id;
    expect(sourcerId).toBeTruthy();

    const assigned = await admin
      .from('candidate_profiles')
      .update({ sourcer_id: sourcerId })
      .eq('person_id', person);
    expect(assigned.error, 'the sourcer has to own the record to see it at all').toBeNull();

    await signIn(page, PERSONA_EMAILS.sourcer);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    const flag = page.locator('.cand-flag-toggle');
    await expect(flag).toBeVisible({ timeout: 25000 });
    await expect(
      flag,
      'canEditProfile is admin or recruiter only, so the control has to say why it is dead',
    ).toBeDisabled();
    await expect(flag).toHaveAttribute(
      'title',
      'Only an admin or a recruiter can change this flag',
    );

    await admin.from('candidate_profiles').update({ sourcer_id: null }).eq('person_id', person);
  });
});

test.describe('C: paging and the date field', () => {
  test('C7: the record pager walks the list both ways, and by name from a cold URL', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, '/recruit/candidates');
    await page.waitForSelector('.table-wrap tbody tr');
    const names = await page.locator('.table-wrap tbody tr .link-btn').allInnerTexts();
    expect(names.length, 'this test needs at least three rows to page through').toBeGreaterThan(2);

    await page.locator('.table-wrap tbody tr .link-btn').first().click();
    await page.waitForSelector('.record-action-bar');
    await expect(page.locator('.fo-page-head h1')).toHaveText(names[0]!.trim());

    expect(
      await page.evaluate(
        () =>
          Array.from(document.querySelectorAll('.fo-page-head .text-secondary')).filter(
            (s) => (s as HTMLElement).innerText.trim() === '|',
          ).length,
      ),
      'the pipe between the flag and the pager is gone',
    ).toBe(0);

    const pager = page.locator('.fo-record-pager');
    const previous = pager.getByRole('button', { name: 'Previous candidate' });
    const next = pager.getByRole('button', { name: 'Next candidate' });

    await expect(pager, 'a record pager, not a bare Next link').toHaveCount(1);
    await expect(
      previous,
      'on the first row of the list there is nowhere back to go',
    ).toBeDisabled();
    await expect(previous).toHaveAttribute(
      'title',
      'This is the first candidate on the list page you came from',
    );
    await expect(next).toBeEnabled();
    await expect(pager, 'the pager states where you are').toContainText(`1 of ${names.length}`);

    await next.click();
    await expect(page.locator('.fo-page-head h1')).toHaveText(names[1]!.trim(), {
      timeout: 15000,
    });
    await expect(
      pager.getByRole('button', { name: 'Previous candidate' }),
      'and going forward makes back available',
    ).toBeEnabled();
    await expect(pager).toContainText(`2 of ${names.length}`);

    await pager.getByRole('button', { name: 'Previous candidate' }).click();
    await expect(
      page.locator('.fo-page-head h1'),
      'Previous returns to the record it came from',
    ).toHaveText(names[0]!.trim(), { timeout: 15000 });

    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    const cold = page.locator('.fo-record-pager');
    await expect(cold).toHaveCount(1);
    await expect(
      cold.getByRole('button', { name: 'Next candidate' }),
      'arriving by URL there are no siblings, so both directions fall back to a keyset query',
    ).toBeEnabled({ timeout: 15000 });
    await expect(cold.getByRole('button', { name: 'Next candidate' })).toHaveAttribute(
      'title',
      'Next candidate by name',
    );
    await expect(
      cold.locator('.fo-record-pager-pos'),
      'the position is unknown without a list, so it is not claimed',
    ).toHaveCount(0);

    const before = await page.locator('.fo-page-head h1').innerText();
    await cold.getByRole('button', { name: 'Next candidate' }).click();
    await expect
      .poll(async () => page.locator('.fo-page-head h1').innerText(), {
        timeout: 15000,
        message: 'and it actually moves to another candidate',
      })
      .not.toBe(before);
  });

  test('C11: a menu option highlights exactly like a select option, on both records', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    const settled = async (locator: import('@playwright/test').Locator) => {
      const rest = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
      await locator.hover();
      return locator.evaluate(
        (el, before) =>
          new Promise<{ background: string; property: string; duration: string }>((resolve) => {
            const deadline = Date.now() + 5000;
            let previous = '';
            const sample = () => {
              const now = getComputedStyle(el).backgroundColor;
              const done = now !== before && now === previous;
              if (done || Date.now() > deadline) {
                resolve({
                  background: now,
                  property: getComputedStyle(el).transitionProperty.split(', ')[0],
                  duration: getComputedStyle(el).transitionDuration.split(', ')[0],
                });
                return;
              }
              previous = now;
              requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          }),
        rest,
      );
    };

    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');
    await page.getByLabel('Main status').click();
    const option = page.locator('.field-select-option').nth(1);
    await expect(option).toBeVisible();
    const selectOption = await settled(option);
    expect(
      selectOption.duration,
      'a dropdown option fades its highlight rather than snapping',
    ).not.toBe('0s');
    await page.keyboard.press('Escape');

    for (const [label, route] of [
      ['candidate', `/recruit/candidates/${person}`],
      ['requisition', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001'],
    ] as const) {
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.record-action-bar .fo-action-menu-trigger');
      await page.locator('.record-action-bar .fo-action-menu-trigger').click();
      const item = page.locator('.fo-action-menu-item').nth(1);
      await expect(item).toBeVisible();

      expect(
        await settled(item),
        `${label}: an overflow-menu option must use the same highlight as a select option, from one rule and one token`,
      ).toEqual(selectOption);
      await page.keyboard.press('Escape');
    }
  });

  test('C14: the ellipsis trigger keeps its own borderless treatment', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    for (const [label, route] of [
      ['candidate', `/recruit/candidates/${person}`],
      ['requisition', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001'],
    ] as const) {
      await gotoAsSignedIn(page, route);
      await page.waitForSelector('.record-action-bar .fo-action-menu-trigger');

      const dots = '.record-action-bar .fo-action-menu-trigger';
      expect(
        await page.evaluate(
          (sel) => getComputedStyle(document.querySelector(sel) as HTMLElement).borderTopWidth,
          dots,
        ),
        `${label}: the trigger is a borderless icon button; giving it a button border was tried and reverted`,
      ).toBe('0px');

      expect(
        await page.evaluate(() => {
          const bar = document.querySelector('.record-action-bar') as HTMLElement;
          const all = Array.from(bar.querySelectorAll('button'));
          return all[all.length - 1]?.classList.contains('fo-action-menu-trigger');
        }),
        `${label}: the ellipsis is the last control in the bar`,
      ).toBe(true);
    }
  });

  test('C10: there is no Edit button, because the fields were never behind one', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    await expect(
      page.locator('.record-action-bar').getByRole('button', { name: 'Edit', exact: true }),
      'Edit only expanded a section and focused its first input. Nothing on this page has an edit mode, and no field of people is writable anywhere in the app, so the label promised a state change that does not exist',
    ).toHaveCount(0);

    const section = page.locator('#candidate-information');
    await expect(section).toHaveCount(1);
    if ((await section.getAttribute('data-open')) !== 'true') {
      await page.getByRole('button', { name: /^Candidate Information/ }).click();
    }
    await expect(section).toHaveAttribute('data-open', 'true', { timeout: 15000 });

    const editable = section.locator(
      '.info-form-grid input:not([disabled]), .info-form-grid textarea:not([disabled])',
    );
    await expect(
      editable.first(),
      'the profile fields are live the moment the section is open',
    ).toBeVisible({ timeout: 15000 });
    await editable.first().focus();
    expect(
      await page.evaluate(() => document.activeElement?.closest('.info-form-grid') !== null),
    ).toBe(true);
  });

  test('C8: the calendar sits inside the date field, everywhere', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);

    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^Candidate Information/ }).click();
    await page.waitForSelector('.info-form-grid .date-field-row');

    const inset = await page.evaluate(() => {
      const row = document.querySelector('.info-form-grid .date-field-row') as HTMLElement;
      const input = row.querySelector('input') as HTMLElement;
      const button = row.querySelector('.date-field-btn') as HTMLElement;
      return {
        rowBorder: getComputedStyle(row).borderTopWidth,
        inputBorder: getComputedStyle(input).borderTopWidth,
        buttonBorder: getComputedStyle(button).borderTopWidth,
        gap: Math.round(
          button.getBoundingClientRect().left - input.getBoundingClientRect().right,
        ),
        withinRow:
          button.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1,
        icons: button.querySelectorAll('svg').length,
      };
    });
    expect(inset.rowBorder, 'one border around the pair, not two').toBe('1px');
    expect(inset.inputBorder, 'the input inside it is borderless').toBe('0px');
    expect(inset.buttonBorder, 'and so is the calendar button').toBe('0px');
    expect(inset.gap, 'no gutter between them, so it reads as one control').toBe(0);
    expect(inset.withinRow, 'the calendar is inside the field, not beside it').toBe(true);
    expect(inset.icons, 'and it is the existing DateField calendar, not a new one').toBe(1);
  });

  test('C9: the info groups share one rhythm and no label wraps', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^Candidate Information/ }).click();
    await page.waitForSelector('.info-group .info-grid');
    await page.getByRole('button', { name: /^Tracking/ }).click();
    await page.waitForSelector('.info-item dt');

    const shape = await page.evaluate(() => {
      const body = document.querySelector('#candidate-information .record-section-body') as HTMLElement;
      const groups = Array.from(document.querySelectorAll('.info-group')) as HTMLElement[];
      return {
        sectionBodyGap: getComputedStyle(body).rowGap,
        padding: [
          ...new Set(
            groups
              .slice(1)
              .map(
                (g) => `${getComputedStyle(g).paddingTop}/${getComputedStyle(g).paddingBottom}`,
              ),
          ),
        ],
        firstPadding: groups[0]
          ? `${getComputedStyle(groups[0]).paddingTop}/${getComputedStyle(groups[0]).paddingBottom}`
          : null,
        rules: [...new Set(groups.slice(1).map((g) => getComputedStyle(g).borderTopWidth))],
        candidateInfoPadding: [
          ...new Set(
            Array.from(document.querySelectorAll('#candidate-information .info-grid')).map(
              (g) => getComputedStyle(g as HTMLElement).paddingLeft,
            ),
          ),
        ],
        otherGridPadding: [
          ...new Set(
            Array.from(
              document.querySelectorAll('.record-section:not(#candidate-information) .info-grid'),
            ).map((g) => getComputedStyle(g as HTMLElement).paddingLeft),
          ),
        ],
        wrappedLabels: Array.from(document.querySelectorAll('.info-item dt'))
          .filter((node) => {
            const d = node as HTMLElement;
            const cs = getComputedStyle(d);
            const line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
            const inner =
              d.getBoundingClientRect().height -
              parseFloat(cs.paddingTop) -
              parseFloat(cs.paddingBottom);
            return inner > line * 1.5;
          })
          .map((d) => (d as HTMLElement).innerText),
        groups: groups.length,
      };
    });

    expect(
      shape.sectionBodyGap,
      'the section body gap is shared with every other record section and must not be removed',
    ).toBe('16px');
    expect(shape.groups, 'at least two groups render').toBeGreaterThan(1);
    expect(
      shape.padding,
      `one padding value drives the rhythm on every group after the first; got ${shape.padding.join(' | ')}`,
    ).toHaveLength(1);
    expect(
      shape.firstPadding,
      'the first group drops its top padding, so the section does not open on a blank band',
    ).toBe('0px/12px');
    expect(
      shape.rules,
      'a 1px low-contrast rule separates consecutive groups',
    ).toEqual(['1px']);
    expect(
      shape.candidateInfoPadding,
      'the Candidate Information grids are indented, scoped to that accordion by its id',
    ).toEqual(['16px']);
    expect(
      shape.otherGridPadding,
      'no other section on the page picks that indent up',
    ).not.toContain('16px');
    expect(
      shape.wrappedLabels,
      `Tracking's label wrapped onto two lines in a cell with room to spare; it must not. Wrapping now: ${shape.wrappedLabels.join(', ') || 'none'}`,
    ).not.toContain('Candidate record last updated');
  });
});

test.describe('C: loading', () => {
  test('C15: the record loads behind a skeleton, never a line of text', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.route('**/rest/v1/people*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });

    const navigation = page.goto(`/recruit/candidates/${person}`);
    await page.waitForSelector('.fo-skeleton-sections', { timeout: 15000 });

    const shape = await page.evaluate(() => ({
      head: document.querySelectorAll('.fo-head-skeleton').length,
      sections: document.querySelectorAll('.fo-skeleton-section').length,
      role: document.querySelector('.skeleton')?.getAttribute('role') ?? null,
      loadingText: /Loading\u2026/.test(document.body.innerText),
    }));

    expect(
      shape.loadingText,
      'the record used to render the bare string "Loading…" while it waited',
    ).toBe(false);
    expect(shape.head, 'a head bar, the same shape the requisition record uses').toBe(1);
    expect(
      shape.sections,
      'one collapsed accordion shape per section on this page',
    ).toBeGreaterThan(10);
    expect(shape.role, 'and it announces itself').toBe('status');

    await navigation;
    await page.unroute('**/rest/v1/people*');
    await expect(page.locator('.record-action-bar')).toBeVisible({ timeout: 25000 });
  });
});

test.describe('C: grading', () => {
  test('C12: the page-head star is permanent, unlabelled, and saves', async ({ page }) => {
    const admin = await clientAs('admin');
    await admin.from('candidate_profiles').update({ star_grade: null }).eq('person_id', person);

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    const header = page.locator('.fo-page-head .cand-header-grade');
    await expect(
      header,
      'the star is permanent, so it shows even before anyone has graded',
    ).toBeVisible({ timeout: 25000 });
    await expect(
      page.locator('.fo-page-head'),
      'the label was removed; the stars carry themselves next to the title',
    ).not.toContainText('Amir Grade');

    const stars = header.locator('button');
    await expect(stars, 'a three-star scale').toHaveCount(3);
    await stars.nth(2).click();
    await page.getByRole('button', { name: 'Save profile' }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from('candidate_profiles')
            .select('star_grade')
            .eq('person_id', person)
            .single();
          return data?.star_grade ?? null;
        },
        { timeout: 15000, message: 'grading from the header must reach the database' },
      )
      .toBe(3);

    await admin.from('candidate_profiles').update({ star_grade: null }).eq('person_id', person);
  });

  test('C13: Amir Grade leads the grading group on its own line', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^Candidate Information/ }).click();
    await page.waitForSelector('.cand-grade-row');

    const shape = await page.evaluate(() => {
      const group = Array.from(document.querySelectorAll('.info-group')).find(
        (g) =>
          (g.querySelector('.info-group-label') as HTMLElement | null)?.innerText ===
          'Grading and salary',
      ) as HTMLElement;
      const row = group.querySelector('.cand-grade-row') as HTMLElement;
      const grid = group.querySelector('.info-form-grid') as HTMLElement;
      return {
        order: Array.from(group.children).map((c) => (c as HTMLElement).className.split(' ')[0]),
        gradeBeforeFields: row.compareDocumentPosition(grid) === 4,
        sameWidth:
          Math.round(row.getBoundingClientRect().width) ===
          Math.round(grid.getBoundingClientRect().width),
        firstField: (grid.querySelector('.field-label') as HTMLElement | null)?.innerText,
        starsInGrid: grid.querySelectorAll('.star-grade, [class*="star"]').length,
      };
    });

    expect(
      shape.order,
      `the group reads label, description, grade, then fields; got ${shape.order.join(' > ')}`,
    ).toEqual(['info-group-label', 'info-group-hint', 'field', 'info-form-grid']);
    expect(shape.gradeBeforeFields, 'the grade comes before the field grid').toBe(true);
    expect(shape.sameWidth, 'and it takes its own full-width line').toBe(true);
    expect(shape.firstField, 'so the grid now opens on Initial date').toBe('Initial date');
    expect(shape.starsInGrid, 'no star control is left inside the field grid').toBe(0);
  });
});

test.describe('C: the candidate record sections', () => {
  test('C4: Candidate Information is grouped, not one flat list', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^Candidate Information/ }).click();

    const groups = page.locator('.info-group-label');
    await expect(groups.first()).toBeVisible({ timeout: 15000 });
    const labels = await groups.allInnerTexts();
    expect(labels, 'the fields are split into named groups').toContain('Name');
    expect(labels).toContain('Contact');
    expect(labels).toContain('Location');
    expect(labels).toContain('Grading and salary');

    expect(
      await page.locator('.record-section h2[style]').count(),
      'the two inline-styled sub-headings are gone',
    ).toBe(0);
    expect(
      await page.locator('.info-form-grid').count(),
      'the editable fields get a form grid, not the label/value grid',
    ).toBe(1);
    expect(
      await page.locator('.info-form-grid .field-wide textarea').count(),
      'the grade comment spans the full width instead of squeezing into a column',
    ).toBe(1);
  });

  test('C5: there is one requisition accordion, not two saying the same thing', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-section');

    await expect(
      page.getByRole('button', { name: /^Requisition Summary/ }),
      'the linking one survives',
    ).toBeVisible({ timeout: 25000 });
    await expect(
      page.getByRole('button', { name: /^Requisition Details/ }),
      'Requisition Details rendered the same apps array with the link removed',
    ).toHaveCount(0);
  });

  test('C6: Web Links are cards, open in a new tab, and name their host', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.getByRole('button', { name: /^Web Links/ }).click();

    const cards = page.locator('.fo-link-card');
    await expect(cards.first()).toBeVisible({ timeout: 15000 });
    const shape = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.fo-link-card')).map((a) => ({
        meta: (a.querySelector('.fo-link-card-meta') as HTMLElement)?.innerText ?? '',
        target: a.getAttribute('target'),
        rel: a.getAttribute('rel'),
        underline: getComputedStyle(a).textDecorationLine,
      })),
    );
    expect(shape.length, 'two search links plus the profile on file').toBeGreaterThanOrEqual(3);
    expect(shape.map((c) => c.meta)).toContain('google.com');
    expect(shape.map((c) => c.meta)).toContain('linkedin.com');
    for (const card of shape) {
      expect(card.target, 'Google and LinkedIn refuse to be framed, so each opens a tab').toBe(
        '_blank',
      );
      expect(card.rel).toContain('noreferrer');
      expect(card.underline, 'and a card is not an underlined link').toBe('none');
    }
  });
});

test.describe('C: submit and print', () => {
  const REQ_TITLE = `Crreq${RUN}`;
  let requisition = '';

  test.beforeAll(async () => {
    const admin = await clientAs('admin');
    const { data, error } = await admin
      .from('requisitions')
      .insert({ title: REQ_TITLE, status: 'open', num_openings: 1, is_test: true })
      .select('id, display_code')
      .single();
    if (error) throw error;
    requisition = data.id;
  });

  test.afterAll(async () => {
    const admin = await clientAs('admin');
    await admin.from('applications').delete().eq('requisition_id', requisition);
    const { error } = await admin.from('requisitions').delete().eq('id', requisition);
    if (error) throw new Error(`could not remove the submit fixture: ${error.message}`);
  });

  test('C16: View Resume with nothing on file is disabled, not "still in development"', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    const view = page.locator('.record-action-bar').getByRole('button', { name: 'View Resume' });
    await expect(view).toBeDisabled();
    await expect(
      view,
      'the fixture has no resume, which is a data state, not an unshipped feature',
    ).toHaveAttribute('title', /No resume on file/);
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  });

  test('C17: Print profile prints the record instead of opening a placeholder', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    await page.getByRole('button', { name: 'More actions' }).click();
    await expect(
      page.getByRole('menuitem', { name: 'Print Resume' }),
      'Taleo prints the formatted profile, not the uploaded file, so the label says so',
    ).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Print profile' }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed), {
        timeout: 15000,
        message:
          'printExpanded waits for every lazily mounted section to stop being busy before it prints, the same path Printable View uses on a requisition',
      })
      .toBe(1);
    await expect
      .poll(async () => page.locator('.record-section[data-open="false"]').count(), {
        timeout: 15000,
        message: 'and the whole record is expanded by the time it prints',
      })
      .toBe(0);
    await expect(page.locator('.fo-placeholder-modal')).toHaveCount(0);
  });

  test('C18: Submit puts the candidate forward on a requisition', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Submit' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(/Submit .* to a requisition/);
    await dialog.getByLabel('Search requisitions').fill(REQ_TITLE);

    const row = dialog.locator('.panel-item', { hasText: REQ_TITLE });
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });

    const admin = await clientAs('admin');
    const { data, error } = await admin
      .from('applications')
      .select('stage')
      .eq('requisition_id', requisition)
      .eq('person_id', person)
      .single();
    expect(error, 'the application must exist after submitting').toBeNull();
    expect(data?.stage, 'Submit means the submitted stage, which the triggers then log').toBe(
      'submitted',
    );
  });

  test('C19: submitting again offers to move the existing application, not to duplicate it', async ({
    page,
  }) => {
    const admin = await clientAs('admin');
    await admin
      .from('applications')
      .upsert(
        { requisition_id: requisition, person_id: person, stage: 'screening' },
        { onConflict: 'requisition_id,person_id' },
      );

    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Submit' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Search requisitions').fill(REQ_TITLE);
    const row = dialog.locator('.panel-item', { hasText: REQ_TITLE });
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(
      row.getByRole('button', { name: 'Move to submitted' }),
      'applications are unique on (requisition, person), so a second submit must update, not insert',
    ).toBeVisible();
    await expect(row).toContainText(/already on this requisition at screening/);

    await row.getByRole('button', { name: 'Move to submitted' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 15000 });

    const { data } = await admin
      .from('applications')
      .select('stage')
      .eq('requisition_id', requisition)
      .eq('person_id', person)
      .single();
    expect(data?.stage).toBe('submitted');
  });

  test('C21: the submit dialog is its own width and rhythm, and leaves the others alone', async ({
    page,
  }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Submit' }).click();

    const panel = page.locator('.rq-dialog.cand-submit-dialog');
    await expect(panel).toBeVisible();
    await expect(
      panel.locator('.panel-item').first(),
      'the dialog lists open requisitions before anything is typed, and the rhythm is measured on one',
    ).toBeVisible({ timeout: 15000 });
    const shape = await panel.evaluate((el) => {
      const stack = el.querySelector('.panel-stack') as HTMLElement;
      const item = el.querySelector('.panel-item') as HTMLElement;
      const row = el.querySelector('.cand-submit-row') as HTMLElement;
      const text = el.querySelector('.cand-submit-text') as HTMLElement;
      const button = row.querySelector('button') as HTMLElement;
      const textBox = text.getBoundingClientRect();
      const buttonBox = button.getBoundingClientRect();
      return {
        width: getComputedStyle(el).width,
        gap: getComputedStyle(stack).rowGap,
        padBottom: getComputedStyle(item).paddingBottom,
        align: getComputedStyle(row).alignItems,
        wrapsBoth:
          text.querySelector('.panel-item-title') !== null &&
          text.querySelector('.panel-item-body') !== null,
        centreOffset: Math.abs(
          buttonBox.top + buttonBox.height / 2 - (textBox.top + textBox.height / 2),
        ),
      };
    });
    expect(shape.width).toBe('500px');
    expect(shape.gap).toBe('12px');
    expect(shape.padBottom, 'a requisition row needs the same 12px under it').toBe('12px');
    expect(shape.align, 'the Submit button sits on the middle of the row, not its first baseline').toBe(
      'center',
    );
    expect(shape.wrapsBoth, 'the title and the meta line share one element beside the button').toBe(
      true,
    );
    expect(
      shape.centreOffset,
      'and the button is centred against that whole block, not against the title alone',
    ).toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    await gotoAsSignedIn(page, `/recruit/requisitions/${requisition}`);
    await page.getByRole('button', { name: 'Add candidate' }).click();
    const shared = page.locator('.rq-dialog');
    await expect(shared).toBeVisible();
    await expect(shared.locator('.panel-item').first()).toBeVisible({ timeout: 15000 });
    const untouched = await shared.evaluate((el) => ({
      scoped: el.classList.contains('cand-submit-dialog'),
      rows: el.querySelectorAll('.cand-submit-row').length,
      headAlign: getComputedStyle(el.querySelector('.panel-item-head') as HTMLElement).alignItems,
      width: getComputedStyle(el).width,
      gap: getComputedStyle(el.querySelector('.panel-stack') as HTMLElement).rowGap,
      padBottom: getComputedStyle(el.querySelector('.panel-item') as HTMLElement).paddingBottom,
    }));
    expect(untouched.scoped, 'Add candidate uses the same Dialog and must not pick up the new class').toBe(
      false,
    );
    expect(untouched.width, 'the shared recruit dialog stays 440px').toBe('440px');
    expect(untouched.gap, 'and keeps the shared 16px stack gap').toBe('16px');
    expect(untouched.padBottom, 'and the shared 8px row padding').toBe('8px');
    expect(untouched.rows, 'the wrapper element belongs to the submit dialog alone').toBe(0);
    expect(
      untouched.headAlign,
      'and .panel-item-head keeps its baseline alignment everywhere else',
    ).toBe('baseline');
  });

});

test('C20: printing expands every accordion, then puts them back', async ({ page }) => {
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
  await page.waitForSelector('.record-section');

  const collapseAll = page.getByRole('button', { name: /all sections$/ });
  await collapseAll.click();
  if ((await page.locator('.record-section[data-open="true"]').count()) > 0) {
    await collapseAll.click();
  }
  await expect
    .poll(async () => page.locator('.record-section[data-open="true"]').count(), { timeout: 15000 })
    .toBe(0);

  const closed = await page.evaluate(() => {
    window.dispatchEvent(new Event('beforeprint'));
    const sections = Array.from(document.querySelectorAll('.record-section'));
    return {
      total: sections.length,
      open: sections.filter((el) => el.getAttribute('data-open') === 'true').length,
      empty: sections
        .filter((el) => {
          const body = el.querySelector('.record-section-body');
          return (body?.textContent ?? '').trim() === '' && (body?.childElementCount ?? 0) > 0;
        })
        .map((el) => el.querySelector('.record-section-header')?.textContent?.trim() ?? '?'),
      withContent: sections.filter(
        (el) => (el.querySelector('.record-section-body')?.textContent ?? '').trim() !== '',
      ).length,
      information: (
        document.querySelector('#candidate-information .record-section-body')?.textContent ?? ''
      ).trim().length,
    };
  });
  expect(closed.total, 'the candidate record has its full set of sections').toBeGreaterThan(10);
  expect(
    closed.open,
    'a section that was never opened renders null children, so expanding has to happen synchronously before the browser snapshots the page',
  ).toBe(closed.total);
  expect(
    closed.empty,
    'a section that rendered elements must render their text too. SidePanelTabs returns null when every tab count is 0, so an untouched Contact Log is legitimately nothing at all and is not counted here',
  ).toEqual([]);
  expect(closed.withContent, 'nearly every section must print something').toBeGreaterThanOrEqual(
    closed.total - 1,
  );
  expect(closed.information, 'Candidate Information is the one that must never print blank').toBeGreaterThan(0);

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect
    .poll(async () => page.locator('.record-section[data-open="true"]').count(), { timeout: 15000 })
    .toBe(0);
});

test('C22: opening a candidate makes no request with an empty uuid', async ({ page }) => {
  const rejected: string[] = [];
  page.on('response', (res) => {
    if (res.status() >= 400 && res.url().includes('/rest/v1/')) {
      rejected.push(`${res.status()} ${decodeURIComponent(res.url().split('/rest/v1/')[1] ?? '')}`);
    }
  });
  await signIn(page, PERSONA_EMAILS.admin);
  await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
  await page.waitForSelector('.record-section');
  await page.waitForTimeout(2000);
  expect(
    rejected,
    'useEngagement was called with an empty application id, so activities, tasks, reminders and attachments each asked Postgres to compare a uuid with "" and got 22P02',
  ).toEqual([]);
});
