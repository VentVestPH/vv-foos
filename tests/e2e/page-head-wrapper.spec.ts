import { expect, test } from '@playwright/test';
import { PERSONA_EMAILS, gotoAsSignedIn, signIn } from './helpers';

const ROUTES = [
  ['candidates', '/recruit/candidates'],
  ['requisitions', '/recruit/requisitions'],
  ['deals', '/sales/deals'],
  ['contacts', '/sales/contacts'],
  ['intake', '/intake'],
  ['candidate record', '/recruit/candidates/b0000000-0000-4000-8000-000000000002'],
  ['requisition record', '/recruit/requisitions/d0000000-0000-4000-8000-000000000001'],
] as const;

test('K18: every page header sits in an opaque wrapper that also holds its search and buttons', async ({
  page,
}) => {
  test.setTimeout(180000);
  await signIn(page, PERSONA_EMAILS.admin);
  const offenders: string[] = [];

  for (const [name, path] of ROUTES) {
    await gotoAsSignedIn(page, path);
    const head = page.locator('.fo-page-head');
    await expect(head, `${name} must have a page head wrapper`).toBeVisible({ timeout: 25000 });
    await expect(
      page.locator('.fo-skeleton-card, .fo-skeleton-sections, .fo-page-skeleton'),
      `${name}: judge the real head, not the skeleton standing in for it`,
    ).toHaveCount(0, { timeout: 25000 });

    const info = await head.first().evaluate((el) => {
      const cs = getComputedStyle(el);
      const heading = el.querySelector('h1');
      const assembly = el.parentElement ?? el;
      const search = assembly.querySelector('input[type="search"], .list-page-search');
      const button = assembly.querySelector('.btn, button');
      return {
        background: cs.backgroundColor,
        holdsHeading: heading !== null,
        holdsSearchOrButton: search !== null || button !== null,
      };
    });

    if (/rgba\(0, 0, 0, 0\)|transparent/.test(info.background)) {
      offenders.push(`${name}: the wrapper is see-through (${info.background})`);
    }
    if (!info.holdsHeading) offenders.push(`${name}: the wrapper does not hold the heading`);
    if (!info.holdsSearchOrButton) {
      offenders.push(`${name}: the wrapper holds neither the search box nor any button`);
    }
  }

  expect(
    offenders,
    'a sticky page head must be opaque and must contain its own controls',
  ).toEqual([]);
});

test('K18: a hand-rolled title row gets the same opaque treatment as the shared one', async ({
  page,
}) => {
  test.setTimeout(120000);
  await signIn(page, PERSONA_EMAILS.admin);
  for (const [name, path] of [
    ['intake linkedin', '/intake/linkedin'],
    ['intake sheet', '/intake/sheet'],
  ] as const) {
    await gotoAsSignedIn(page, path);
    const row = page.locator('.record-page > .record-title-row').first();
    await expect(row, `${name} should render a title row`).toBeVisible({ timeout: 25000 });
    const look = await row.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: cs.borderTopWidth, padding: cs.paddingTop };
    });
    expect(look.background, `${name}: the header must not be see-through`).not.toMatch(
      /rgba\(0, 0, 0, 0\)|transparent/,
    );
    expect(look.border, `${name}: the header must be framed like every other`).not.toBe('0px');
    expect(look.padding, `${name}: the header must have padding`).not.toBe('0px');
  }
});
