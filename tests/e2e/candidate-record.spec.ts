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
    for (const item of ['Schedule meeting', 'Print Resume', 'Submit', 'Merge duplicate…']) {
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
      await expect
        .poll(async () => locator.evaluate((el) => getComputedStyle(el).backgroundColor), {
          timeout: 5000,
          message: 'waiting for the highlight transition to settle',
        })
        .not.toBe(rest);
      return locator.evaluate((el) => ({
        background: getComputedStyle(el).backgroundColor,
        property: getComputedStyle(el).transitionProperty.split(', ')[0],
        duration: getComputedStyle(el).transitionDuration.split(', ')[0],
      }));
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

  test('C10: Edit opens the editable fields and puts the cursor in one', async ({ page }) => {
    await signIn(page, PERSONA_EMAILS.admin);
    await gotoAsSignedIn(page, `/recruit/candidates/${person}`);
    await page.waitForSelector('.record-action-bar');

    const section = page.locator('#candidate-information');
    await expect(
      section,
      'the button needs a section to open, so the id has to be there',
    ).toHaveCount(1);

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await expect(section).toHaveAttribute('data-open', 'true', { timeout: 15000 });
    await expect
      .poll(
        async () =>
          page.evaluate(
            () => document.activeElement?.closest('.info-form-grid') !== null,
          ),
        {
          timeout: 15000,
          message:
            'Edit used to scroll to Main Status Details and stop; it must land the cursor in an editable field',
        },
      )
      .toBe(true);
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
      const body = document.querySelector('.record-section-body') as HTMLElement;
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
